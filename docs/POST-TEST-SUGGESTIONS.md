# Post-Test Suggestions & Triage Checklist

A prioritized list of things to verify, fix, and improve after running the build locally. Priority:
🔴 likely to block/bite · 🟡 worth doing soon · 🟢 nice-to-have.

Install steps are in [`INSTALL.md`](./INSTALL.md).

---

## A. What "fully tested" should cover
Run through these and note what works / breaks; send logs for anything red.

- [ ] **Boot** — `docker compose up --build` starts web + sync + processing; `localhost:3000` loads; login works.
- [ ] **Plaud connect** — paste token → status **connected** (and correct regional host).
- [ ] **Mirror** — **Sync now** pulls recordings; check titles, dates, durations, audio, and Plaud's transcript/summary.
- [ ] **Search** — a known word returns the right recording.
- [ ] **Local transcription** — **Transcribe** a short clip (after enabling `faster-whisper`).
- [ ] **Analysis** — **Summary / Flashcards / Q&A** produce sensible output.
- [ ] **Drive archive** — try connecting + archiving one recording.
- [ ] **Token expiry** — a stale token flips status to "token expired".
- [ ] Capture `docker compose logs sync` and `logs processing` for any errors.

## B. Expected to bite — fix first
- [ ] 🔴 **Google Drive OAuth flow** — uses the deprecated "out-of-band" (paste-code) method Google disabled in 2022; likely fails. Switch to a **loopback redirect** (`http://localhost:<port>/callback`).
- [ ] 🔴 **In-app viewer for outputs** — the UI lists recordings and flags but can't **show** transcript/summary/flashcards/Q&A or **play audio**; outputs only exist as files in `data/recordings/<id>/`. Add a recording **detail view** + **audio player**.
- [ ] 🔴 **Plaud field mappings** — verify real field names/units (title, `start_time` seconds-vs-ms, duration, segment fields, summary shape, `is_trash`). Fix from `logs sync` if titles/dates/transcripts look wrong.
- [ ] 🟡 **Whisper model expectations** — default to `base`/`small` for testing; `large-v3` on CPU is very slow (~3 GB download).
- [ ] 🟡 **Ollama setup** — must run `--profile ollama` and `ollama pull <model>` before analysis works.

## C. Robustness & correctness
- [ ] 🟡 **Surface job status in the UI** — poll `/api/jobs/:id` so failed/long transcriptions are visible (currently only in logs).
- [ ] 🟡 **Reconcile updates & deletions** — re-pull edited recordings; remove ones trashed/deleted on Plaud (poller currently skips fully-mirrored items).
- [ ] 🟡 **Transcription concurrency limit** — a queue/semaphore in `processing` so parallel Whisper jobs don't exhaust RAM/CPU.
- [ ] 🟢 **Long-recording handling** — transcripts are truncated to 120k chars before the LLM; add chunked map-reduce summarization.
- [ ] 🟢 **Gateway route tests** — end-to-end tests for analyze/flashcards/qa against a mock processing server (poller + analysis layer are already covered).

## D. Security & ops
- [ ] 🔴 **Strong `AUTH_SECRET` + `APP_PASSWORD`**; do **not** expose to the internet without a reverse proxy + HTTPS (set cookie `secure`).
- [ ] 🟡 **Login rate-limiting** (brute-force protection); **HMAC-sign webhooks** if used.
- [ ] 🟡 **Production web serving** — build static assets instead of the Vite dev server; pin `packageManager` in Dockerfiles for reproducible builds.
- [ ] 🟢 **Compose healthchecks** so `sync` waits for `processing` to be truly ready.
- [ ] 🟢 **Disk-space awareness / retention** — local audio + Drive copies add up.

## E. Resilience — "survives if Plaud disappears" (Phase 4)
- [ ] 🔴 **Restore-from-Drive** — rebuild local state entirely from the archive (the whole point of the backup).
- [ ] 🟡 **Verify-after-upload + checksums** in `index.json` (extend the audio md5 to all files).
- [ ] 🟢 **Optional encryption-at-rest** before upload.

## F. UX polish (Phase 5)
- [ ] Recording **detail view** + **waveform player** with timestamped transcript seeking (see B).
- [ ] **Setup wizard** (token → Drive → LLM → Whisper).
- [ ] Date/duration formatting in the list; dark/light theme.

## G. Deferred (already on the roadmap)
- [ ] Browser-profile token **auto-extraction**.
- [ ] Speaker **diarization** (needs `pyannote` + a HuggingFace token).
- [ ] Granular progress % for long transcriptions.

---

## Top 3 to do right after testing
1. Fix the **Google Drive OAuth flow** (B).
2. Add a **recording detail view + audio player** so the app is actually usable (B/F).
3. Correct any **Plaud field mappings** surfaced by the logs (B).
