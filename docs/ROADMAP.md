# Roadmap

This repo currently ships the **foundation**: the monorepo, service skeletons, Docker Compose
wiring, single-user auth, event contract, on-demand processing flow, and the Google Drive
archiver. The items below turn the skeleton into the full product.

## Phase 1 — Foundation ✅ (this commit)
- [x] Monorepo layout (`web`, `sync`, `processing`) + Docker Compose
- [x] Single-user auth on the gateway
- [x] SQLite state model + data layout / `index.json` manifest
- [x] Plaud client + poller skeleton
- [x] Webhook emitter (`audio_ready` / `transcript_ready` / `archived`)
- [x] Processing service (`/transcribe`, `/analyze`) with provider abstraction
- [x] Google Drive archiver (OAuth user account)
- [x] Minimal web shell (login + recordings list + actions)

## Phase 2 — Make the mirror real ✅ (mostly)
- [x] Production Plaud client: regional hosts, audio via `/file/temp-url` (streamed S3 download +
      md5), `/ai/transsumm` transcripts/summaries, `-302` region correction, browser-UA + 5xx retries
- [x] Runtime token configuration + 401/expiry handling (paste a fresh token in the UI; no restart;
      persisted to `$DATA_DIR/plaud-config.json`)
- [x] Full-text search across transcripts (SQLite FTS5 + `GET /api/search`)
- [x] Robust incremental sync + dedupe (skip fully-mirrored, retry pending transcripts, poll lock)
- [ ] Browser-profile token *auto*-extraction (OS-specific; deferred — paste the token for now)

## Phase 3 — Make local processing real
- [ ] Wire `insanely-fast-whisper` with real model management + batching
- [ ] Diarization / speaker labels for local transcripts
- [ ] Flashcards + Q&A generation (from `landoncrabtree/applaud`)
- [ ] Job queue + progress UI for long transcriptions

## Phase 4 — Archive & resilience
- [ ] Verify-after-upload + checksums in `index.json`
- [ ] Optional "always archive" + scheduled re-sync of the whole library
- [ ] Restore-from-Drive flow (rebuild local state purely from the archive)
- [ ] Optional encryption-at-rest before upload

## Phase 5 — UX polish
- [ ] Waveform player + timestamped transcript seeking (from `rsteckler/applaud`)
- [ ] Setup wizard (Plaud token, Drive, LLM, Whisper)
- [ ] Dark/light theme

## Known caveats
- Plaud access is via an undocumented API and may break if Plaud changes it.
- This repo reimplements the concepts of both upstream projects with original code rather than
  copying their source, so `landoncrabtree/applaud` having no upstream license is not a blocker.
  See `NOTICE.md` for the full explanation.
