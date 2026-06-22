// Tiny fetch wrapper. Cookies (the session) ride along automatically (same-origin via proxy).
export interface Recording {
  id: string;
  title: string | null;
  source: string;
  created_at: number | null;
  has_plaud_transcript: number;
  has_local_transcript: number;
  has_local_summary: number;
  archive_status: string;
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
  archive: (id: string) => req(`/recordings/${id}/archive`, { method: "POST" }),
  driveStatus: (): Promise<{ connected: boolean }> => req("/drive/status"),
};
