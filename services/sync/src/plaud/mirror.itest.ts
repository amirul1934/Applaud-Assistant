// Integration test: runs the real Plaud client + poller against a mock Plaud server that mimics the
// documented response shapes. Exercises list/detail/audio/transcript, FTS search, dedupe, the -302
// region correction, and 401 token-expiry handling — everything except Plaud's real field names.
//
// Run with: pnpm test
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

// Point the data dir + token at throwaways before importing modules that read them on load.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "applaud-itest-"));
process.env.PLAUD_BEARER_TOKEN = process.env.PLAUD_BEARER_TOKEN ?? "test-token";

const { setApiBase, setBearerToken, getState } = await import("./store.js");
const client = await import("./client.js");
const { getRecording, searchTranscripts } = await import("../db.js");
const { pollOnce } = await import("../sync/poller.js");

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

interface Mock {
  url: string;
  close: () => Promise<void>;
}

function startServer(handler: Handler): Promise<Mock> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function json(res: http.ServerResponse, body: unknown, status = 200) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

test("mirror: end-to-end download + transcript + search + dedupe", async () => {
  const counts = { list: 0, detail: 0, audio: 0, transsumm: 0 };
  let base = "";
  const mock = await startServer((req, res) => {
    const url = req.url ?? "";
    if (url.startsWith("/file/simple/web")) {
      counts.list++;
      return json(res, { data_file_list: [{ id: "rec1", is_trash: 0 }] });
    }
    if (url.startsWith("/file/detail/")) {
      counts.detail++;
      return json(res, {
        data: { file_id: "rec1", file_name: "Team Standup", duration: 95, start_time: 1700000000, is_trash: 0 },
      });
    }
    if (url.startsWith("/file/temp-url/")) {
      return json(res, { temp_url: `${base}/s3/rec1.opus` });
    }
    if (url.startsWith("/s3/")) {
      counts.audio++;
      res.writeHead(200);
      return res.end(Buffer.from("FAKE-AUDIO-BYTES"));
    }
    if (url.startsWith("/ai/transsumm/")) {
      counts.transsumm++;
      return json(res, {
        data_result: [
          { start: 0, speaker: "Alice", content: "hello world from standup" },
          { start: 5, speaker: "Bob", content: "we deploy on friday" },
        ],
        data_result_summ: "## Summary\n- shipped the thing\n",
      });
    }
    res.writeHead(404);
    res.end("nope");
  });
  base = mock.url;

  try {
    setApiBase(mock.url);
    setBearerToken("test-token");

    await pollOnce();

    const rec = getRecording.get("rec1") as any;
    assert.ok(rec, "recording row created");
    assert.equal(rec.title, "Team Standup");
    assert.equal(rec.duration_sec, 95);
    assert.equal(rec.has_plaud_transcript, 1);
    assert.equal(rec.created_at, 1700000000 * 1000, "start_time seconds -> ms");
    assert.ok(rec.audio_path && fs.existsSync(rec.audio_path), "audio file on disk");
    assert.ok(fs.statSync(rec.audio_path).size > 0, "audio not empty");

    const dir = path.dirname(rec.audio_path);
    assert.ok(fs.existsSync(path.join(dir, "plaud.transcript.txt")), "transcript text written");
    assert.match(fs.readFileSync(path.join(dir, "plaud.summary.md"), "utf8"), /shipped the thing/);

    const hits = searchTranscripts.all("deploy") as any[];
    assert.equal(hits.length, 1);
    assert.equal(hits[0].id, "rec1");

    // Second poll must be a no-op (already fully mirrored) — no re-download / re-fetch.
    await pollOnce();
    assert.equal(counts.audio, 1, "audio downloaded exactly once (dedupe)");
    assert.equal(counts.transsumm, 1, "transcript fetched exactly once (dedupe)");
  } finally {
    await mock.close();
  }
});

test("client: follows -302 region correction to the right host", async () => {
  const serverB = await startServer((req, res) => {
    if ((req.url ?? "").startsWith("/file/simple/web")) {
      return json(res, { data_file_list: [{ id: "recB", is_trash: 0 }] });
    }
    res.writeHead(404);
    res.end();
  });
  const serverA = await startServer((_req, res) => {
    json(res, { status: -302, data: { host: serverB.url } });
  });

  try {
    setApiBase(serverA.url);
    setBearerToken("test-token");
    const items = await client.listAll();
    assert.equal(getState().apiBase, serverB.url, "apiBase switched to corrected region");
    assert.ok(items.some((i) => i.id === "recB"), "data came from corrected host");
  } finally {
    await serverA.close();
    await serverB.close();
  }
});

test("poll: marks token invalid on 401", async () => {
  const mock = await startServer((_req, res) => json(res, { error: "unauthorized" }, 401));
  try {
    setApiBase(mock.url);
    setBearerToken("expired-token");
    await pollOnce(); // must not throw
    assert.equal(getState().tokenValid, false, "token flagged invalid after 401");
  } finally {
    await mock.close();
  }
});
