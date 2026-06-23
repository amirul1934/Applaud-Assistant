// Thin client for the internal Python processing service.
import { config } from "./config.js";

export interface TranscribeResult {
  text: string;
  segments: { start: number; end: number; text: string }[];
}

export interface AnalyzeResult {
  summary: string;
}

export interface Flashcard {
  front: string;
  back: string;
}
export interface QAItem {
  question: string;
  answer: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${config.processingUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`processing ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export const processing = {
  transcribe: (audioPath: string) =>
    post<TranscribeResult>("/transcribe", { audio_path: audioPath }),
  analyze: (transcript: string, opts?: { provider?: string; model?: string }) =>
    post<AnalyzeResult>("/analyze", { transcript, ...opts }),
  flashcards: (transcript: string, opts?: { provider?: string; model?: string }) =>
    post<{ cards: Flashcard[] }>("/flashcards", { transcript, ...opts }),
  qa: (transcript: string, opts?: { provider?: string; model?: string }) =>
    post<{ qa: QAItem[] }>("/qa", { transcript, ...opts }),
  health: async () => {
    const res = await fetch(`${config.processingUrl}/health`);
    return res.ok;
  },
};
