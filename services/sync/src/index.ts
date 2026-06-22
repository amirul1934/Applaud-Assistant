// Applaud-Assistant gateway: auth, recordings API, on-demand processing, Drive archive, poller.
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { login, logout, requireAuth } from "./auth.js";
import {
  createJob,
  getRecording,
  listRecordings,
  setFlag,
  updateJob,
  type Recording,
} from "./db.js";
import { processing } from "./processingClient.js";
import { emit } from "./webhooks.js";
import { runArchive } from "./archiveQueue.js";
import { getConsentUrl, isConnected, saveTokenFromCode } from "./archive/drive.js";
import { startPoller } from "./sync/poller.js";

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

// On-demand local Whisper transcription.
api.post("/recordings/:id/transcribe", async (req, res) => {
  const rec = getRecording.get(req.params.id) as Recording | undefined;
  if (!rec?.audio_path) return res.status(404).json({ error: "no audio" });
  const job = createJob.run(rec.id, "transcribe", Date.now(), Date.now());
  try {
    const result = await processing.transcribe(rec.audio_path);
    const dir = path.join(config.recordingsDir, rec.id);
    fs.writeFileSync(path.join(dir, "local.transcript.json"), JSON.stringify(result, null, 2));
    setFlag(rec.id, "has_local_transcript", 1);
    updateJob.run("done", null, Date.now(), Number(job.lastInsertRowid));
    await emit("transcript_ready", { id: rec.id, source: "local" });
    res.json({ ok: true, segments: result.segments.length });
  } catch (e) {
    updateJob.run("error", (e as Error).message, Date.now(), Number(job.lastInsertRowid));
    res.status(502).json({ error: (e as Error).message });
  }
});

// On-demand local LLM analysis (summary). Reads the best available transcript.
api.post("/recordings/:id/analyze", async (req, res) => {
  const rec = getRecording.get(req.params.id) as Recording | undefined;
  if (!rec) return res.status(404).json({ error: "not found" });
  const dir = path.join(config.recordingsDir, rec.id);
  const localT = path.join(dir, "local.transcript.json");
  const plaudT = path.join(dir, "plaud.transcript.json");
  const file = fs.existsSync(localT) ? localT : fs.existsSync(plaudT) ? plaudT : null;
  if (!file) return res.status(409).json({ error: "no transcript yet — transcribe first" });

  const transcript = JSON.parse(fs.readFileSync(file, "utf8"));
  const text = typeof transcript.text === "string" ? transcript.text : JSON.stringify(transcript);
  const job = createJob.run(rec.id, "analyze", Date.now(), Date.now());
  try {
    const { summary } = await processing.analyze(text, {
      provider: req.body?.provider,
      model: req.body?.model,
    });
    fs.writeFileSync(path.join(dir, "local.summary.md"), summary);
    setFlag(rec.id, "has_local_summary", 1);
    updateJob.run("done", null, Date.now(), Number(job.lastInsertRowid));
    res.json({ ok: true });
  } catch (e) {
    updateJob.run("error", (e as Error).message, Date.now(), Number(job.lastInsertRowid));
    res.status(502).json({ error: (e as Error).message });
  }
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

app.use("/api", api);

app.listen(config.port, () => {
  console.log(`[sync] listening on :${config.port}`);
  startPoller();
});
