# Attribution & Notices

Applaud-Assistant is an **original implementation** whose architecture and feature set were
*inspired by* two existing projects. The code in this repository was written for this project; it
does **not** include copied source code from either upstream. We credit both for the ideas.

## Inspired by: rsteckler/applaud
- Source: https://github.com/rsteckler/applaud
- License: MIT
- Ideas reflected here: the Plaud.ai mirroring approach (browser-session JWT, polling the Plaud
  web API), the webhook event model (`audio_ready` / `transcript_ready`), and a TypeScript/Express
  + SQLite service shape.

## Inspired by: landoncrabtree/applaud
- Source: https://github.com/landoncrabtree/applaud
- License: none declared upstream at the time of writing.
- Ideas reflected here: a fully-local pipeline — Whisper transcription and multi-provider LLM
  analysis (OpenAI, Anthropic, Google/Gemini, Ollama, OpenRouter) — plus derivative-content
  concepts (summaries, flashcards, Q&A).

## Licensing notes (plain English)

- **Ideas vs. code.** Copyright protects the specific *code* someone wrote, not the general *idea*
  ("transcribe with Whisper, then summarize with an LLM"). This repository reimplements the ideas
  with its own code, so the absence of a license on `landoncrabtree/applaud` does not restrict it.
- **Don't copy their files.** If actual source files from `landoncrabtree/applaud` were ever pasted
  into this repo, that code would be "all rights reserved" until its author adds a license. We
  don't do that here.
- **rsteckler/applaud is MIT**, which permits reuse with attribution — this notice provides it.
- **This repository's own code** is offered under the MIT License (see `LICENSE`).

### Optional: make it airtight
If you want zero ambiguity, open a friendly issue on `landoncrabtree/applaud` asking the author to
add a `LICENSE` file (MIT is a common, permissive choice). Many maintainers are happy to oblige.
This is a nice-to-have, not a blocker.
