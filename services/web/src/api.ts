// Tiny fetch wrapper. Cookies (the session) ride along automatically (same-origin via proxy).
export interface Recording {
  id: string;
  title: string | null;
  source: string;
  created_at: number | null;
  has_plaud_transcript: number;
  has_local_transcript: number;
  has_local_summary: number;
  has_local_flashcards: number;
  has_local_qa: number;
  archive_status: string;
}

export interface SearchHit {
  id: string;
  source: string;
  title: string | null;
  snippet: string;
}

export interface PlaudStatus {
  configured: boolean;
  tokenValid: boolean;
  apiBase: string;
}

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    req("/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => req("/logout", { method: "POST" }),
  recordings: (): Promise<Recording[]> => req("/recordings"),
  transcribe: (id: string) => req(`/recordings/${id}/transcribe`, { method: "POST" }),
  analyze: (id: string) => req(`/recordings/${id}/analyze`, { method: "POST" }),
  flashcards: (id: string) => req(`/recordings/${id}/flashcards`, { method: "POST" }),
  qa: (id: string) => req(`/recordings/${id}/qa`, { method: "POST" }),
  archive: (id: string) => req(`/recordings/${id}/archive`, { method: "POST" }),
  driveStatus: (): Promise<{ connected: boolean }> => req("/drive/status"),
  search: (q: string): Promise<SearchHit[]> => req(`/search?q=${encodeURIComponent(q)}`),
  plaudStatus: (): Promise<PlaudStatus> => req("/plaud/status"),
  setPlaudToken: (token: string) =>
    req("/plaud/token", { method: "POST", body: JSON.stringify({ token }) }),
  syncNow: () => req("/plaud/sync", { method: "POST" }),
};
