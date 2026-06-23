import React, { useEffect, useState } from "react";
import { api, type PlaudStatus, type Recording, type SearchHit } from "./api";

export function App() {
  const [authed, setAuthed] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [plaud, setPlaud] = useState<PlaudStatus | null>(null);
  const [token, setToken] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);

  const refresh = () => {
    api.recordings().then(setRecordings).catch((e) => setError(e.message));
    api.plaudStatus().then(setPlaud).catch(() => {});
  };

  useEffect(() => {
    // Probe auth by attempting to load recordings.
    api
      .recordings()
      .then((r) => {
        setAuthed(true);
        setRecordings(r);
        api.plaudStatus().then(setPlaud).catch(() => {});
      })
      .catch(() => setAuthed(false));
  }, []);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return setResults([]);
    api.search(query).then(setResults).catch((e) => setError(e.message));
  };

  const saveToken = () => {
    if (!token.trim()) return;
    api
      .setPlaudToken(token)
      .then(() => {
        setToken("");
        setTimeout(refresh, 800);
      })
      .catch((e) => setError(e.message));
  };

  if (!authed) return <Login onLogin={() => { setAuthed(true); refresh(); }} />;

  return (
    <main style={page}>
      <header style={headerRow}>
        <h1 style={{ margin: 0 }}>Applaud-Assistant</h1>
        <button onClick={() => api.logout().then(() => setAuthed(false))}>Log out</button>
      </header>

      <section style={panel}>
        <div style={{ fontSize: 13 }}>
          Plaud:{" "}
          {plaud?.configured ? (
            plaud.tokenValid ? (
              <b style={{ color: "green" }}>connected</b>
            ) : (
              <b style={{ color: "crimson" }}>token expired</b>
            )
          ) : (
            <b style={{ color: "#a60" }}>not configured</b>
          )}
          {plaud?.apiBase ? <span style={{ opacity: 0.6 }}> · {plaud.apiBase}</span> : null}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1 }}
            placeholder="paste Plaud bearer token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button onClick={saveToken}>Save token</button>
          <button onClick={() => act(api.syncNow(), refresh, setError)}>Sync now</button>
        </div>
      </section>

      <form onSubmit={search} style={{ display: "flex", gap: 8 }}>
        <input
          style={{ flex: 1 }}
          placeholder="search transcripts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>
      {results.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {results.map((h, i) => (
            <li key={`${h.id}-${i}`} style={card}>
              <div>
                <strong>{h.title ?? "Untitled"}</strong>{" "}
                <span style={{ fontSize: 11, opacity: 0.6 }}>({h.source})</span>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{h.snippet}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {recordings.length === 0 && <p style={{ opacity: 0.7 }}>No recordings mirrored yet.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {recordings.map((r) => (
          <li key={r.id} style={card}>
            <div>
              <strong>{r.title ?? "Untitled"}</strong>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {r.source} ·{" "}
                {r.has_local_transcript
                  ? "local transcript"
                  : r.has_plaud_transcript
                  ? "plaud transcript"
                  : "no transcript"}
                {r.has_local_summary ? " · summary" : ""}
                {r.has_local_flashcards ? " · cards" : ""}
                {r.has_local_qa ? " · q&a" : ""}
                {" · archive: "}
                {r.archive_status}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button onClick={() => act(api.transcribe(r.id), refresh, setError)}>Transcribe</button>
              <button onClick={() => act(api.analyze(r.id), refresh, setError)}>Summary</button>
              <button onClick={() => act(api.flashcards(r.id), refresh, setError)}>Flashcards</button>
              <button onClick={() => act(api.qa(r.id), refresh, setError)}>Q&amp;A</button>
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
const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
const panel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 12,
};
const card: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 12,
  marginBottom: 8,
};
