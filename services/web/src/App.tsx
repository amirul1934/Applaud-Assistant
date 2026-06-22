import { useEffect, useState } from "react";
import { api, type Recording } from "./api";

export function App() {
  const [authed, setAuthed] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => api.recordings().then(setRecordings).catch((e) => setError(e.message));

  useEffect(() => {
    // Probe auth by attempting to load recordings.
    api
      .recordings()
      .then((r) => {
        setAuthed(true);
        setRecordings(r);
      })
      .catch(() => setAuthed(false));
  }, []);

  if (!authed) return <Login onLogin={() => { setAuthed(true); refresh(); }} />;

  return (
    <main style={page}>
      <header style={header}>
        <h1 style={{ margin: 0 }}>Applaud-Assistant</h1>
        <button onClick={() => api.logout().then(() => setAuthed(false))}>Log out</button>
      </header>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {recordings.length === 0 && <p style={{ opacity: 0.7 }}>No recordings mirrored yet.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {recordings.map((r) => (
          <li key={r.id} style={card}>
            <div>
              <strong>{r.title ?? "Untitled"}</strong>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {r.source} · {r.has_local_transcript ? "local transcript" : r.has_plaud_transcript ? "plaud transcript" : "no transcript"} · archive: {r.archive_status}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => act(api.transcribe(r.id), refresh, setError)}>Transcribe</button>
              <button onClick={() => act(api.analyze(r.id), refresh, setError)}>Analyze</button>
              <button onClick={() => act(api.archive(r.id), refresh, setError)}>Archive</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

function act(p: Promise<unknown>, refresh: () => void, setError: (s: string) => void) {
  p.then(refresh).catch((e) => setError(e.message));
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    api.login(u, p).then(onLogin).catch((e) => setErr(e.message));
  };
  return (
    <form onSubmit={submit} style={{ ...page, maxWidth: 320 }}>
      <h1>Applaud-Assistant</h1>
      <input placeholder="username" value={u} onChange={(e) => setU(e.target.value)} />
      <input placeholder="password" type="password" value={p} onChange={(e) => setP(e.target.value)} />
      <button type="submit">Log in</button>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
    </form>
  );
}

const page: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  maxWidth: 760,
  margin: "40px auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const card: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 12,
  marginBottom: 8,
};
