// Background poller: incrementally mirrors Plaud recordings into local storage.
//
// Per cycle it lists all recordings and, for any that aren't fully mirrored yet (missing audio or
// transcript), fetches detail, streams the audio to disk, and pulls Plaud's transcript/summary.
// Already-complete recordings are skipped (dedupe). Plaud transcribes asynchronously, so a
// recording with audio but no transcript is retried on later cycles until the transcript appears.
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { getRecording, indexTranscript, upsertRecording, type Recording } from "../db.js";
import * as plaud from "../plaud/client.js";
import { isConfigured } from "../plaud/store.js";
import { emit } from "../webhooks.js";
import { maybeAutoArchive } from "../archiveQueue.js";

async function mirrorOne(id: string): Promise<void> {
  const existing = getRecording.get(id) as Recording | undefined;
  const dir = path.join(config.recordingsDir, id);
  fs.mkdirSync(dir, { recursive: true });

  const detail = await plaud.getFileDetail(id);
  if (detail.isTrash) return;

  // 1) audio — download once, streamed straight to disk
  let audioPath = existing?.audio_path ?? null;
  let audioJustArrived = false;
  if (!audioPath || !fs.existsSync(audioPath)) {
    audioPath = path.join(dir, "audio.opus");
    const { md5 } = await plaud.downloadAudioToFile(id, audioPath);
    fs.writeFileSync(path.join(dir, "audio.md5"), md5);
    audioJustArrived = true;
  }

  // 2) transcript + summary — retry on later cycles until Plaud finishes processing
  let hasTranscript = existing?.has_plaud_transcript ? 1 : 0;
  let transcriptJustArrived = false;
  if (!hasTranscript) {
    const t = await plaud.getTranscript(id).catch(() => null);
    if (t) {
      fs.writeFileSync(path.join(dir, "plaud.transcript.json"), JSON.stringify(t.segments, null, 2));
      fs.writeFileSync(path.join(dir, "plaud.transcript.txt"), t.text);
      if (t.summaryMarkdown) fs.writeFileSync(path.join(dir, "plaud.summary.md"), t.summaryMarkdown);
      indexTranscript(id, "plaud", t.text);
      hasTranscript = 1;
      transcriptJustArrived = true;
    }
  }

  upsertRecording.run({
    id,
    title: detail.title,
    source: "plaud",
    created_at: detail.startTime,
    mirrored_at: Date.now(),
    audio_path: audioPath,
    duration_sec: detail.durationSec ?? null,
    has_plaud_transcript: hasTranscript,
  });

  if (audioJustArrived) {
    await emit("audio_ready", { id, title: detail.title, audioPath, source: "plaud" });
  }
  if (transcriptJustArrived) {
    await emit("transcript_ready", { id, source: "plaud" });
  }
  // Auto-archive once a recording first becomes available locally.
  if (!existing) await maybeAutoArchive(id);
}

let isPolling = false;

export async function pollOnce(): Promise<void> {
  if (!isConfigured() || isPolling) return;
  isPolling = true;
  try {
    const items = await plaud.listAll();
    for (const it of items) {
      if (it.isTrash) continue;
      const existing = getRecording.get(it.id) as Recording | undefined;
      // Fully mirrored already (audio + transcript) — nothing to do.
      if (existing?.audio_path && existing.has_plaud_transcript) continue;
      await mirrorOne(it.id).catch((e) => console.error("[poller] mirror", it.id, (e as Error).message));
    }
  } catch (e) {
    if (e instanceof plaud.PlaudAuthError) {
      console.error("[poller] Plaud token invalid — paste a fresh one in Settings");
    } else {
      console.error("[poller] poll failed:", (e as Error).message);
    }
  } finally {
    isPolling = false;
  }
}

export function startPoller() {
  console.log(
    `[poller] interval ${config.plaud.pollInterval}s, plaud ${isConfigured() ? "configured" : "NOT configured"}`
  );
  pollOnce();
  setInterval(pollOnce, config.plaud.pollInterval * 1000);
}
