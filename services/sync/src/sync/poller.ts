// Background poller: mirrors new Plaud recordings into local storage on an interval.
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { getRecording, upsertRecording } from "../db.js";
import { PlaudClient, type PlaudFile } from "../plaud/client.js";
import { emit } from "../webhooks.js";
import { maybeAutoArchive } from "../archiveQueue.js";

const plaud = new PlaudClient();

async function mirrorFile(file: PlaudFile) {
  const existing = getRecording.get(file.id);
  if (existing) return; // already mirrored — Phase 2 will reconcile updates

  const dir = path.join(config.recordingsDir, file.id);
  fs.mkdirSync(dir, { recursive: true });

  // 1) audio — streamed straight to disk to keep memory flat for large recordings
  let audioPath: string | null = null;
  if (file.audioUrl) {
    audioPath = path.join(dir, "audio.mp3");
    await plaud.downloadAudioToFile(file, audioPath);
  }

  // 2) Plaud's own transcript/summary, if present
  let hasPlaudTranscript = 0;
  if (file.hasTranscript) {
    const t = await plaud.getTranscript(file.id);
    if (t) {
      fs.writeFileSync(path.join(dir, "plaud.transcript.json"), JSON.stringify(t.transcript, null, 2));
      fs.writeFileSync(path.join(dir, "plaud.summary.md"), t.summary ?? "");
      hasPlaudTranscript = 1;
    }
  }

  upsertRecording.run({
    id: file.id,
    title: file.title,
    source: "plaud",
    created_at: file.createdAt,
    mirrored_at: Date.now(),
    audio_path: audioPath,
    duration_sec: file.durationSec ?? null,
    has_plaud_transcript: hasPlaudTranscript,
  });

  if (audioPath) await emit("audio_ready", { id: file.id, title: file.title, audioPath, source: "plaud" });
  if (hasPlaudTranscript) await emit("transcript_ready", { id: file.id, source: "plaud" });

  // On-demand processing is the default, but archiving can run automatically.
  await maybeAutoArchive(file.id);
}

let isPolling = false;

export async function pollOnce() {
  // Skip if not configured, or if a previous cycle is still running (avoids overlapping polls).
  if (!plaud.configured || isPolling) return;
  isPolling = true;
  try {
    const files = await plaud.listFiles();
    for (const f of files) await mirrorFile(f).catch((e) => console.error("mirror", f.id, e));
  } catch (e) {
    console.error("poll failed:", (e as Error).message);
  } finally {
    isPolling = false;
  }
}

export function startPoller() {
  console.log(`[poller] interval ${config.plaud.pollInterval}s, plaud ${plaud.configured ? "configured" : "NOT configured"}`);
  pollOnce();
  setInterval(pollOnce, config.plaud.pollInterval * 1000);
}
