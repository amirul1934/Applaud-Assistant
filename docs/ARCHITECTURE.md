# Architecture

Applaud-Assistant is a small set of cooperating services. The design goal is to keep the two
upstream strengths intact — a mature TypeScript Plaud mirror and a capable Python Whisper/LLM
pipeline — while presenting a single product.

## Services

### `web` — unified UI (Vite + React)
The only thing the user's browser talks to (besides login). Lists recordings, plays audio, shows
transcripts/summaries, and exposes the **"Transcribe locally"**, **"Analyze locally"**, and
**"Archive to Drive"** actions. All calls go to `sync` under `/api/*`.

### `sync` — gateway & orchestrator (TypeScript + Express + SQLite)
The brain. Responsibilities:
- **Auth** — single-user login; issues a signed session token; guards every `/api` route.
- **Plaud mirror** — polls the Plaud web API on an interval, downloads new audio + Plaud's own
  transcript/summary, and records state in SQLite.
- **Webhooks** — emits `audio_ready` and `transcript_ready` to configured URLs.
- **Orchestration** — on user request, calls the internal `processing` service to run Whisper /
  LLM, then stores results next to the recording.
- **Archive** — the Google Drive archiver (OAuth user account) uploads audio, transcripts,
  summaries, and a per-recording `index.json` manifest.

`sync` is the *only* publicly exposed service. It owns the database and the data directory.

### `processing` — private compute (Python + FastAPI)
Stateless, internal-only HTTP service. Two endpoints that matter:
- `POST /transcribe` — runs Whisper (`insanely-fast-whisper`, device auto/cpu/cuda/mps) on a file
  path and returns segments + text.
- `POST /analyze` — runs an LLM provider (Ollama/OpenAI/Anthropic/Gemini/OpenRouter) over a
  transcript to produce a summary (and, later, flashcards/Q&A).

It reads/writes the shared `/data` volume and never holds long-term state.

## Processing model (on-demand)

A mirrored recording arrives already carrying Plaud's transcript + summary, so by default we just
mirror. Local Whisper/LLM is **triggered per-recording from the UI** (or via API). This keeps GPU
use intentional while still giving a fully-offline path that's independent of Plaud. Switching to
"always run local" later is a config change, not a redesign.

## Data layout

```
$DATA_DIR/
  applaud.sqlite                 # state: recordings, processing jobs, archive status
  recordings/<id>/
    audio.<ext>                  # mirrored from Plaud (or uploaded)
    plaud.transcript.json        # Plaud's transcript (if present)
    plaud.summary.md             # Plaud's summary (if present)
    local.transcript.json        # local Whisper output (on demand)
    local.summary.md             # local LLM output (on demand)
    index.json                   # manifest describing everything above
```

`index.json` is what makes the Google Drive archive **self-describing**: even without this app,
the archive folder for a recording explains what each file is, where it came from, and when.

## Event contract

| Event              | Emitted when                                  | Payload (summary)                         |
|--------------------|-----------------------------------------------|-------------------------------------------|
| `audio_ready`      | mirrored audio finishes downloading           | `{ id, title, audioPath, source, ts }`    |
| `transcript_ready` | a transcript (Plaud or local) is available    | `{ id, source: 'plaud'\|'local', text }`  |
| `archived`         | a recording is uploaded to Google Drive       | `{ id, driveFolderId, files[] }`          |

## Security posture

- Single-user auth in front of everything user-facing.
- `processing` is never published to the host — only reachable on the compose network.
- Secrets (Plaud token, Google OAuth refresh token, LLM keys) live in `.env` / the `secrets/`
  volume, never in the database or git.
