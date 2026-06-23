# Setup

## 0. Prerequisites
- Docker + Docker Compose (the easy path), or Node 20 + pnpm and Python 3.11 + FFmpeg for local
  dev.
- (Optional) an NVIDIA GPU for fast Whisper; CPU works but is slower.

## 1. Configure
```bash
cp .env.example .env
```
Fill in at minimum: `APP_USERNAME`, `APP_PASSWORD`, `AUTH_SECRET`.

## 2. Plaud token (mirror)
Plaud has no public API. The bearer token comes from your logged-in browser session:
1. Log in to the Plaud web app in your browser.
2. Open DevTools → Application → Local Storage → copy the bearer/JWT token.
3. Either paste it into `PLAUD_BEARER_TOKEN` in `.env`, **or** start the app and paste it into the
   Plaud panel in the UI (stored at `$DATA_DIR/plaud-config.json`, so it survives restarts).

> The UI shows the connection state (connected / token expired / not configured) and has a **Sync
> now** button. When the token expires the status flips to "token expired" — just paste a fresh one;
> no restart needed. Browser-profile auto-extraction (no manual copy) is a future enhancement.

## 3. Google Drive archive (OAuth)
1. In Google Cloud Console, create an OAuth **Desktop app** client; enable the **Drive API**.
2. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.
3. Start the stack, open the UI → **Settings → Connect Google Drive**, and complete the consent
   flow. The refresh token is stored under `./secrets/` and reused thereafter.
4. Archives are written to the folder named by `GDRIVE_ARCHIVE_FOLDER` in your My Drive.

## 4. LLM providers
Set `LLM_PROVIDER` and the matching key:
- `ollama` — runs locally; start with `docker compose --profile ollama up`, then
  `docker compose exec ollama ollama pull llama3.1`.
- `openai` / `anthropic` / `gemini` / `openrouter` — set the corresponding `*_API_KEY`.

## 5. Whisper (local transcription)
- Uncomment `faster-whisper` in `services/processing/requirements.txt` to enable it.
- `WHISPER_DEVICE=auto` picks CUDA if available, else CPU.
- `WHISPER_MODEL` (default `base`) — try `small`/`medium` for more accuracy, `large-v3` on a GPU.
- The first transcription downloads the model into `./models`. CPU works (int8); a GPU is far faster.
- The **Summary / Flashcards / Q&A** buttons then run locally via your configured `LLM_PROVIDER`.

## 6. Run
```bash
docker compose up --build
# UI:  http://localhost:3000
# API: http://localhost:8080
```

Log in with `APP_USERNAME` / `APP_PASSWORD`. New Plaud recordings appear automatically; use the
per-recording actions to transcribe/analyze locally and to archive to Drive.
