// Applaud-Assistant gateway: auth, recordings API, on-demand processing, Drive archive, poller.
import fs from "node:fs";
import path from "node:path";
import express, { type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { login, logout, requireAuth } from "./auth.js";
import {
  createJob,
  getJob,
  getRecording,
  indexTranscript,
  listRecordings,
  searchTranscripts,
  setFlag,
  updateJob,
  type Recording,
} from "./db.js";
import { processing } from "./processingClient.js";
import { emit } from "./webhooks.js";
import { runArchive } from "./archiveQueue.js";
import { getConsentUrl, isConnected, saveTokenFromCode } from "./archive/drive.js";
import { startPoller, pollOnce } from "./sync/poller.js";
import { getState, isConfigured, setBearerToken } from "./plaud/store.js";

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// --- Public ---
app.get("/health", async (_req, res) =>
  res.json({ ok: true, processing: await processing.health().catch(() => false) })
);
app.post("/api/login", login);
app.post("/api/logout", logout);

// --- Everything below requires auth ---
const api = express.Router();
api.use(requireAuth);

api.get("/recordings", (_req, res) => res.json(listRecordings.all()));

api.get("/recordings/:id", (req, res) => {
  const rec = getRecording.get(req.params.id) as Recording | undefined;
  if (!rec) return res.status(404).json({ error: "not found" });
  res.json(rec);
});

// On-demand local Whisper transcription. Runs in the background (can take minutes); the response
// returns 202 + a job id immediately so the HTTP request never hangs into a gateway timeout.
api.post("/recordings/:id/transcribe", (req, res) => {
  const rec = getRecording.get(req.params.id) as Recording | undefined;
  if (!rec?.audio_path) return res.status(404).json({ error: "no audio" });
  const jobId = Number(createJob.run(rec.id, "transcribe", Date.now(), Date.now()).lastInsertRowid);

  void (async () => {
    try {
      const result = await processing.transcribe(rec.audio_path!);
      const dir = path.join(config.recordingsDir, rec.id);
      fs.writeFileSync(path.join(dir, "local.transcript.json"), JSON.stringify(result, null, 2));
      if (result.text) indexTranscript(rec.id, "local", result.text);
      setFlag(rec.id, "has_local_transcript", 1);
      updateJob.run("done", null, Date.now(), jobId);
      await emit("transcript_ready", { id: rec.id, source: "local" });
    } catch (e) {
      updateJob.run("error", (e as Error).message, Date.now(), jobId);
    }
  })();

  res.status(202).json({ ok: true, jobId });
});

// --- On-demand local LLM analysis: summary / flashcards / Q&A ---
// All read the best available transcript, run in the background (LLM calls are slow), and report
// via the jobs table (queued -> running -> done/error).
function transcriptTextFor(rec: Recording): string | null {
  const dir = path.join(config.recordingsDir, rec.id);
  const localT = path.join(dir, "local.transcript.json");
  const plaudT = path.join(dir, "plaud.transcript.json");
  const file = fs.existsSync(localT) ? localT : fs.existsSync(plaudT) ? plaudT : null;
  if (!file) return null;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (typeof data?.text === "string") return data.text; // local Whisper result
  if (Array.isArray(data)) return data.map((s: any) => s?.text ?? "").join("\n"); // plaud segments
  return JSON.stringify(data);
}

function startAnalysis(
  req: Request,
  res: Response,
  kind: string,
  outFile: string,
  flagCol: string,
  produce: (text: string, opts: { provider?: string; model?: string }) => Promise<string>
) {
  const rec = getRecording.get(req.params.id) as Recording | undefined;
  if (!rec) return res.status(404).json({ error: "not found" });
  const text = transcriptTextFor(rec);
  if (!text) return res.status(409).json({ error: "no transcript yet — transcribe first" });
  const { provider, model } = req.body ?? {};
  const jobId = Number(createJob.run(rec.id, kind, Date.now(), Date.now()).lastInsertRowid);

  void (async () => {
    updateJob.run("running", null, Date.now(), jobId);
    try {
      const output = await produce(text, { provider, model });
      fs.writeFileSync(path.join(config.recordingsDir, rec.id, outFile), output);
      setFlag(rec.id, flagCol, 1);
      updateJob.run("done", null, Date.now(), jobId);
    } catch (e) {
      updateJob.run("error", (e as Error).message, Date.now(), jobId);
    }
  })();

  res.status(202).json({ ok: true, jobId });
}

api.post("/recordings/:id/analyze", (req, res) =>
  startAnalysis(req, res, "analyze", "local.summary.md", "has_local_summary", async (t, o) =>
    (await processing.analyze(t, o)).summary
  )
);
api.post("/recordings/:id/flashcards", (req, res) =>
  startAnalysis(req, res, "flashcards", "local.flashcards.json", "has_local_flashcards", async (t, o) =>
    JSON.stringify((await processing.flashcards(t, o)).cards, null, 2)
  )
);
api.post("/recordings/:id/qa", (req, res) =>
  startAnalysis(req, res, "qa", "local.qa.json", "has_local_qa", async (t, o) =>
    JSON.stringify((await processing.qa(t, o)).qa, null, 2)
  )
);

// Poll the status of a background job (transcribe / analyze).
api.get("/jobs/:id", (req, res) => {
  const job = getJob.get(Number(req.params.id));
  if (!job) return res.status(404).json({ error: "not found" });
  res.json(job);
});

// Archive a recording to Google Drive on demand.
api.post("/recordings/:id/archive", async (req, res) => {
  try {
    const result = await runArchive(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

// --- Google Drive connection (OAuth) ---
api.get("/drive/status", (_req, res) => res.json({ connected: isConnected() }));
api.get("/drive/connect", (_req, res) => res.json({ url: getConsentUrl() }));
api.post("/drive/callback", async (req, res) => {
  try {
    await saveTokenFromCode(req.body?.code);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// --- Full-text search across transcripts ---
api.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json([]);
  try {
    res.json(searchTranscripts.all(q));
  } catch (e) {
    // FTS5 throws on malformed match expressions — treat as a bad query, not a server error.
    res.status(400).json({ error: (e as Error).message });
  }
});

// --- Plaud connection (token + manual sync) ---
api.get("/plaud/status", (_req, res) => {
  const s = getState();
  res.json({ configured: isConfigured(), tokenValid: s.tokenValid, apiBase: s.apiBase });
});
api.post("/plaud/token", (req, res) => {
  const token = String(req.body?.token ?? "").trim();
  if (!token) return res.status(400).json({ error: "token required" });
  setBearerToken(token);
  pollOnce(); // kick a sync with the fresh token
  res.json({ ok: true });
});
api.post("/plaud/sync", (_req, res) => {
  pollOnce();
  res.json({ ok: true });
});

app.use("/api", api);

app.listen(config.port, () => {
  console.log(`[sync] listening on :${config.port}`);
  startPoller();
});
