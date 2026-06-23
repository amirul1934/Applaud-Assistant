// Real Plaud web-API client.
//
// Plaud has no public API; these are the undocumented endpoints its web app uses (learned from the
// MIT-licensed rsteckler/applaud). Auth is the bearer token from a logged-in browser session, plus
// a spoofed browser User-Agent to get past Plaud's WAF. Responses occasionally carry status -302 to
// redirect to the caller's correct regional host, which we follow and remember.
import fs from "node:fs";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getState, setApiBase, markTokenInvalid } from "./store.js";

const REGIONS: Record<string, string> = {
  "us-west-2": "https://api.plaud.ai",
  "eu-central-1": "https://api-euc1.plaud.ai",
  "ap-southeast-1": "https://api-apse1.plaud.ai",
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

export class PlaudAuthError extends Error {}
export class PlaudApiError extends Error {
  constructor(message: string, readonly status: number, readonly body?: string) {
    super(message);
  }
}

export interface PlaudListItem {
  id: string;
  isTrash: boolean;
}
export interface PlaudDetail {
  id: string;
  title: string;
  startTime: number; // epoch ms
  durationSec?: number;
  isTrash: boolean;
}
export interface TranscriptSegment {
  start: number; // seconds
  speaker: string;
  text: string;
}
export interface PlaudTranscript {
  segments: TranscriptSegment[];
  text: string; // formatted "[HH:MM:SS] Speaker: text" lines
  summaryMarkdown: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function plaudFetch(pathName: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const { bearerToken, apiBase } = getState();
  const res = await fetch(`${apiBase}${pathName}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) {
    markTokenInvalid();
    throw new PlaudAuthError("Plaud token rejected (401) — paste a fresh token in Settings");
  }
  if (res.status >= 500 && attempt < 3) {
    await sleep(500 * 2 ** attempt);
    return plaudFetch(pathName, init, attempt + 1);
  }
  return res;
}

async function plaudJson<T = any>(pathName: string, init: RequestInit = {}, redirects = 0): Promise<T> {
  const res = await plaudFetch(pathName, init);
  const body = await res.text();
  if (!res.ok) throw new PlaudApiError(`Plaud ${pathName} -> ${res.status}`, res.status, body);
  let json: any;
  try {
    json = JSON.parse(body);
  } catch {
    throw new PlaudApiError(`Plaud ${pathName} returned non-JSON`, res.status, body);
  }
  // Region correction: -302 tells us the right regional host. Switch and retry through plaudJson
  // itself (so the retry gets the same ok/JSON/auth handling), bounded to avoid redirect loops.
  if (json?.status === -302 && redirects < 2) {
    const base = resolveRegionalBase(json);
    if (base) {
      setApiBase(base);
      return plaudJson<T>(pathName, init, redirects + 1);
    }
  }
  return json as T;
}

function resolveRegionalBase(json: any): string | null {
  const hint = json?.data?.host ?? json?.host ?? json?.data?.region ?? json?.region;
  if (typeof hint !== "string" || !hint) return null;
  if (hint.startsWith("http")) return hint.replace(/\/$/, "");
  if (REGIONS[hint]) return REGIONS[hint];
  return `https://${hint}`;
}

// --- list ---
export async function listAll(pageSize = 50): Promise<PlaudListItem[]> {
  const out: PlaudListItem[] = [];
  for (let page = 0, skip = 0; page < 200; page++, skip += pageSize) {
    const params = new URLSearchParams({
      skip: String(skip),
      limit: String(pageSize),
      sort_by: "start_time",
      is_desc: "true",
      is_trash: "2",
    });
    const json = await plaudJson<{ data_file_list?: any[] }>(`/file/simple/web?${params.toString()}`);
    const items = json.data_file_list ?? [];
    for (const it of items) {
      const id = String(it.id ?? it.file_id ?? "");
      if (id) out.push({ id, isTrash: Boolean(it.is_trash) });
    }
    if (items.length < pageSize) break;
  }
  return out;
}

// --- detail ---
export async function getFileDetail(id: string): Promise<PlaudDetail> {
  const json = await plaudJson<{ data?: any }>(`/file/detail/${id}`);
  const d = json.data ?? {};
  return {
    id: String(d.file_id ?? id),
    title: String(d.file_name ?? "Untitled"),
    startTime: toMs(d.start_time),
    durationSec: d.duration ? Number(d.duration) : undefined,
    isTrash: Boolean(d.is_trash),
  };
}

// --- audio ---
export async function getAudioUrl(id: string): Promise<string> {
  const json = await plaudJson<{ temp_url?: string }>(`/file/temp-url/${id}?is_opus=1`);
  if (!json.temp_url) throw new PlaudApiError(`no temp_url for ${id}`, 200);
  return json.temp_url;
}

export async function downloadAudioToFile(id: string, dest: string): Promise<{ bytes: number; md5: string }> {
  const url = await getAudioUrl(id);
  const res = await fetch(url); // presigned S3 URL — no Plaud auth
  if (!res.ok || !res.body) throw new PlaudApiError(`audio download ${id} -> ${res.status}`, res.status);
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), fs.createWriteStream(dest));
  return { bytes: fs.statSync(dest).size, md5: await md5File(dest) };
}

function md5File(p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const s = fs.createReadStream(p);
    s.on("error", reject);
    s.on("data", (chunk) => hash.update(chunk));
    s.on("end", () => resolve(hash.digest("hex")));
  });
}

// --- transcript + summary ---
export async function getTranscript(id: string): Promise<PlaudTranscript | null> {
  const json = await plaudJson<any>(`/ai/transsumm/${id}`, { method: "POST", body: "{}" });
  const raw: any[] = Array.isArray(json?.data_result) ? json.data_result : [];
  const segments: TranscriptSegment[] = raw.map((s) => ({
    start: toSeconds(s.start ?? s.start_time ?? s.timestamp ?? s.time ?? 0),
    speaker: String(s.speaker ?? s.speaker_name ?? s.role ?? "Speaker"),
    text: String(s.content ?? s.text ?? s.sentence ?? "").trim(),
  }));
  const summaryMarkdown = extractMarkdown(json?.data_result_summ ?? json?.data_note_result ?? "");
  // Plaud transcribes asynchronously — treat "nothing yet" as not-ready rather than empty success.
  if (segments.length === 0 && !summaryMarkdown) return null;
  const text = segments.map((s) => `[${hhmmss(s.start)}] ${s.speaker}: ${s.text}`).join("\n");
  return { segments, text, summaryMarkdown };
}

// data_result_summ is inconsistent: a JSON-encoded string for normal recordings, a nested object
// for short ones, sometimes plain markdown. Normalize all of these to markdown text.
function extractMarkdown(payload: unknown): string {
  if (!payload) return "";
  if (typeof payload === "string") {
    const s = payload.trim();
    if (s.startsWith("{") || s.startsWith('"') || s.startsWith("[")) {
      try {
        return extractMarkdown(JSON.parse(s));
      } catch {
        return s;
      }
    }
    return s;
  }
  if (typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    return String(o.markdown ?? o.summary ?? o.content ?? o.text ?? "").trim();
  }
  return String(payload);
}

function toMs(v: unknown): number {
  const n = Number(v);
  if (!n) return Date.now();
  return n < 1e12 ? n * 1000 : n; // seconds -> ms heuristic
}
function toSeconds(v: unknown): number {
  const n = Number(v) || 0;
  return n > 1e7 ? n / 1000 : n; // ms -> seconds heuristic
}
function hhmmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  return parts.map((x) => String(x).padStart(2, "0")).join(":");
}
