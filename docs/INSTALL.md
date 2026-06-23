# Installation Guide (step by step)

A beginner-friendly walkthrough to run Applaud-Assistant on your own computer with Docker. If you
just want the short version, see [`SETUP.md`](./SETUP.md).

> **Where this runs:** on *your* machine (or a home server). It's self-hosted — nothing about your
> recordings leaves your computer except the optional Google Drive backup you control.

---

## 0. Install the prerequisites (one time)

| Tool | Why | Get it | Verify |
|------|-----|--------|--------|
| **Docker Desktop** | runs the whole app in containers | https://www.docker.com/products/docker-desktop | `docker --version` |
| **Git** | downloads the code | https://git-scm.com/downloads | `git --version` |

After installing Docker Desktop, **launch it** and wait until it says "running". Docker must be
running before any `docker compose` command will work.

> **Windows:** use **PowerShell** (search "PowerShell" in the Start menu). Docker Desktop will ask
> to enable WSL2 — accept it.
> **macOS / Linux:** use the **Terminal**.

---

## 1. Download the code

```bash
git clone https://github.com/amirul1934/Applaud-Assistant.git
cd Applaud-Assistant
```

Everything below assumes you're inside the `Applaud-Assistant` folder.

---

## 2. Create your configuration file

```bash
cp .env.example .env        # Windows PowerShell:  copy .env.example .env
```

Open `.env` in any text editor and set **these three** (leave the rest at defaults for your first
run):

```ini
APP_USERNAME=admin
APP_PASSWORD=choose-a-strong-password
AUTH_SECRET=a-long-random-string
```

Generate a good `AUTH_SECRET` (and password) with:

```bash
openssl rand -hex 32        # Windows: just type a long random string of your own
```

> 🔒 Don't leave the defaults. This password protects your recordings and cloud credentials.

---

## 3. (Optional) Enable local transcription — Whisper

If you want the app to transcribe audio itself (the private/offline feature), open
`services/processing/requirements.txt` and **remove the `#`** in front of this line:

```text
faster-whisper==1.0.3
```

Then pick a model size in `.env`:

```ini
WHISPER_MODEL=base     # fast, lower accuracy — best for your first test
# WHISPER_MODEL=small  # better accuracy, still CPU-friendly
# WHISPER_MODEL=large-v3   # best accuracy, but ~3 GB and SLOW on CPU (use a GPU)
```

> Start with `base`. The first transcription downloads the model, so give it a minute. You can
> skip this whole step for now and just test the Plaud mirror.

---

## 4. (Optional) Choose your LLM for summaries/flashcards/Q&A

Edit the LLM section of `.env`:

- **Local & private (Ollama):**
  ```ini
  LLM_PROVIDER=ollama
  LLM_MODEL=llama3.1
  ```
  You'll start Ollama in step 5 and pull the model.
- **Hosted (OpenAI / Anthropic / Gemini / OpenRouter):** set `LLM_PROVIDER` and the matching key,
  e.g. `LLM_PROVIDER=openai` and `OPENAI_API_KEY=sk-...`.

You can skip this for the first run and just test mirroring + search.

---

## 5. Start the app

**Without local Ollama:**
```bash
docker compose up --build
```

**With local Ollama (if you chose it in step 4):**
```bash
docker compose --profile ollama up --build
# then, in a second terminal, pull a model once:
docker compose exec ollama ollama pull llama3.1
```

The first build takes a few minutes. When it's ready, open **http://localhost:3000**.

> If `docker compose` isn't recognized, try the older `docker-compose` (with a hyphen).

---

## 6. Get your Plaud token

Plaud has no public API, so the app reuses your browser's login token.

1. In **Chrome**, log into the Plaud **web** app (where you view recordings in a browser).
2. Press **F12** → click the **Network** tab → **refresh** the page.
3. Click any request to **`api.plaud.ai`** (or `api-euc1` / `api-apse1`).
4. Under **Request Headers**, find **`Authorization: Bearer eyJ…`** and copy the long string
   **after** `Bearer ` (it starts with `eyJ`).

---

## 7. Log in and sync

1. In the app, **log in** with the `APP_USERNAME` / `APP_PASSWORD` from your `.env`.
2. In the **Plaud panel**, paste the token → **Save token**. The status should turn **connected**
   (if your account is in EU/Asia it auto-detects the region).
3. Click **Sync now**. Your recordings appear over the next moments. Try the **search** box.

---

## 8. (Optional) Generate transcripts & study material

For any recording: **Transcribe** (local Whisper) → then **Summary**, **Flashcards**, or **Q&A**.

> ⚠️ **Current limitation:** the app doesn't render these in the browser yet — outputs are written
> as files under `data/recordings/<id>/` (e.g. `local.summary.md`, `local.flashcards.json`). An
> in-app viewer is the top item on the post-test list. For now, open those files to read results.

---

## 9. (Optional) Google Drive backup

1. In Google Cloud Console, create an OAuth **Desktop** client and enable the **Drive API**.
2. Put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`, restart, then use the Drive connect
   flow in the app.

> ⚠️ **Heads-up:** the current Drive sign-in uses an older OAuth method Google has since disabled,
> so this step may not complete yet. It's a known item on the post-test list
> ([`POST-TEST-SUGGESTIONS.md`](./POST-TEST-SUGGESTIONS.md)) — test mirroring/transcription first
> and we'll fix the Drive flow.

---

## Day-to-day commands

```bash
docker compose logs -f sync         # watch the mirror/poller (great for spotting issues)
docker compose logs -f processing   # watch transcription/analysis
docker compose down                 # stop everything
git pull                            # get updates, then re-run: docker compose up --build
```

- **Your data** lives in `./data` (database + audio + transcripts). Back it up if it matters.
- **Secrets** live in `.env` and `./secrets` and are never committed to git.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| UI won't load at `:3000` | Docker not running, or ports 3000/8080 in use. Check `docker compose ps`. |
| Plaud shows "token expired" right after saving | Wrong/partial token — re-copy the full `eyJ…` from the Network tab. |
| Recordings don't appear | Check `docker compose logs sync` for `poll failed` / `mirror` errors and share them. |
| Titles "Untitled" or dates wrong | Plaud field-mapping mismatch — send `logs sync`, it's a quick fix. |
| Transcription seems stuck | First run downloads the model; `large-v3` on CPU is very slow — try `base`. |
| Summary/flashcards fail | LLM not reachable: for Ollama, ensure the profile is up and the model pulled; for hosted, check the API key. |
| Drive connect fails | Known OAuth-flow issue — see step 9. |

For everything beyond install, see the prioritized list in
[`POST-TEST-SUGGESTIONS.md`](./POST-TEST-SUGGESTIONS.md).
