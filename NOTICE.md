# Attribution & Notices

Applaud-Assistant is a derivative work that merges ideas and code from two upstream projects:

## rsteckler/applaud
- Source: https://github.com/rsteckler/applaud
- License: MIT
- Contribution to this project: the Plaud.ai mirroring approach (browser-session JWT, polling the
  Plaud web API), webhook event model (`audio_ready` / `transcript_ready`), and the
  TypeScript/Express + SQLite service shape.

## landoncrabtree/applaud
- Source: https://github.com/landoncrabtree/applaud
- License: not explicitly stated upstream at time of writing — **see caveat below**.
- Contribution to this project: the fully-local pipeline — Whisper transcription
  (`insanely-fast-whisper`) and multi-provider LLM analysis (OpenAI, Anthropic, Google/Gemini,
  Ollama, OpenRouter), plus the watcher/derivative-content concepts (summaries, flashcards, Q&A).

## License caveat

The unified code in this repository is offered under the MIT License (see headers / `LICENSE`).
However, `landoncrabtree/applaud` did not declare an explicit license at the time this project
was assembled. Before publishing or distributing any code derived from it, confirm its licensing
terms with the upstream author. Until then, treat the Python `processing` service's
landoncrabtree-derived portions as "all rights reserved by upstream" and keep this repository
private.
