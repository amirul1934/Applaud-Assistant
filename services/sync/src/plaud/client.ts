// Minimal Plaud web-API client.
//
// Plaud exposes no public API. The production approach (see rsteckler/applaud) reuses the bearer
// token from a logged-in browser session and calls the undocumented web endpoints:
//   - list:       GET  /file/simple/web
//   - transcript: GET  /ai/transsumm/<id>
//   - audio:      a signed S3 URL returned in the file metadata
//
// This is the foundation skeleton: the shape is real, but the heavy parsing is a Phase-2 TODO.
import { config } from "../config.js";

const BASE = "https://api.plaud.ai"; // adjust to the observed host

export interface PlaudFile {
  id: string;
  title: string;
  createdAt: number; // epoch ms
  durationSec?: number;
  audioUrl?: string; // signed S3 URL
  hasTranscript: boolean;
}

export class PlaudClient {
  constructor(private token = config.plaud.bearerToken) {}

  get configured() {
    return Boolean(this.token);
  }

  private async get(path: string): Promise<unknown> {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (res.status === 401) throw new Error("PLAUD_TOKEN_EXPIRED");
    if (!res.ok) throw new Error(`plaud ${path} -> ${res.status}`);
    return res.json();
  }

  /** List recordings available in the Plaud account. */
  async listFiles(): Promise<PlaudFile[]> {
    if (!this.configured) return [];
    // TODO(phase2): map the real /file/simple/web response shape.
    const raw = (await this.get("/file/simple/web")) as { data?: unknown[] };
    return (raw.data ?? []).map((f) => normalizeFile(f as Record<string, unknown>));
  }

  /** Fetch Plaud's own transcript + summary for a file. */
  async getTranscript(id: string): Promise<{ transcript: unknown; summary: string } | null> {
    if (!this.configured) return null;
    // TODO(phase2): map the real /ai/transsumm/<id> response.
    return (await this.get(`/ai/transsumm/${id}`)) as { transcript: unknown; summary: string };
  }

  /** Download audio bytes from the signed URL. */
  async downloadAudio(file: PlaudFile): Promise<ArrayBuffer> {
    if (!file.audioUrl) throw new Error(`no audio url for ${file.id}`);
    const res = await fetch(file.audioUrl);
    if (!res.ok) throw new Error(`audio download ${file.id} -> ${res.status}`);
    return res.arrayBuffer();
  }
}

function normalizeFile(f: Record<string, unknown>): PlaudFile {
  return {
    id: String(f.id ?? f.fileId ?? ""),
    title: String(f.title ?? f.name ?? "Untitled"),
    createdAt: Number(f.createdAt ?? f.startTime ?? Date.now()),
    durationSec: f.duration ? Number(f.duration) : undefined,
    audioUrl: f.url ? String(f.url) : undefined,
    hasTranscript: Boolean(f.hasTranscript ?? f.transStatus),
  };
}
