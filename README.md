# Applaud-Assistant

A **unified, self-hosted audio workspace** for your Plaud recordings — fully private and
independent of Plaud's cloud.

It does two things at once:

1. **Mirror** — continuously syncs your Plaud.ai recordings (audio + Plaud's own
   transcripts/summaries) to local storage and fires webhooks, so you always have your own copy.
2. **Process privately** — on demand, runs **local Whisper transcription** and **local/remote
   LLM analysis** (Ollama, OpenAI, Anthropic, Gemini, OpenRouter) on any recording — no cloud
   required.

It also **auto-archives everything to your Google Drive** (audio, transcripts, AI summaries, and
a self-describing index) so your data survives even if Plaud the company disappears.

> This project merges and builds on two excellent open-source projects:
> [`rsteckler/applaud`](https://github.com/rsteckler/applaud) (Plaud mirror + webhooks) and
> [`landoncrabtree/applaud`](https://github.com/landoncrabtree/applaud) (local Whisper + LLM).
> See [`NOTICE.md`](./NOTICE.md) for attribution.

---

## Architecture at a glance

```
                          ┌──────────────────────────────┐
   Browser ──▶ login ──▶  │  web  (Vite/React UI)         │
                          └──────────────┬───────────────┘
                                         │ /api/*
                          ┌──────────────▼───────────────┐
   Plaud cloud ◀──poll──▶ │  sync  (TypeScript / Express) │  ◀── single-user auth, SQLite state
   Google Drive ◀─archive─│   • Plaud mirror + webhooks   │
                          │   • orchestrates processing   │
                          └──────────────┬───────────────┘
                                         │ internal HTTP
                          ┌──────────────▼───────────────┐
   Whisper / LLMs  ◀────▶ │ processing (Python / FastAPI) │
   (Ollama, OpenAI, …)    │   • transcribe • analyze      │
                          └──────────────────────────────┘
```

- **`services/sync`** — the gateway/orchestrator. Mirrors Plaud, holds state (SQLite), handles
  auth, serves the API, emits webhooks, and runs the Google Drive archiver.
- **`services/processing`** — internal Python service that does Whisper transcription and LLM
  analysis. Never exposed publicly; called only by `sync`.
- **`services/web`** — the unified front-end (recordings list, player, transcript viewer,
  "process locally" + "archive" actions).

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full design.

## Quick start

```bash
cp .env.example .env        # fill in your values
docker compose up --build   # web on :3000, sync API on :8080
```

Full setup (Plaud token, Google Drive OAuth, LLM keys, Whisper/GPU) is in
[`docs/SETUP.md`](./docs/SETUP.md).

## Status

🚧 **Active build.** The mirror **and** the private local pipeline are both real now: the monorepo,
Docker Compose wiring, single-user auth, event contracts, the Google Drive archiver, the production
Plaud client (audio + transcripts + summaries, regional hosts, runtime token/expiry handling),
incremental sync, full-text transcript search, **local Whisper transcription (faster-whisper)**, and
**local LLM summary / flashcards / Q&A**. Remaining polish (speaker diarization, richer UI) is tracked
in [`docs/ROADMAP.md`](./docs/ROADMAP.md).
