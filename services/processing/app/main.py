"""Internal processing API: Whisper transcription + LLM analysis.

Not exposed to the host — only the `sync` gateway calls it over the compose network.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .analyze import summarize
from .config import config
from .transcribe import transcribe

app = FastAPI(title="Applaud-Assistant Processing", version="0.1.0")


class TranscribeRequest(BaseModel):
    audio_path: str


class AnalyzeRequest(BaseModel):
    transcript: str
    provider: str | None = None
    model: str | None = None


@app.get("/health")
def health() -> dict:
    return {"ok": True, "device": config.whisper_device, "provider": config.llm_provider}


@app.post("/transcribe")
def do_transcribe(req: TranscribeRequest) -> dict:
    try:
        return transcribe(req.audio_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="audio not found")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze")
def do_analyze(req: AnalyzeRequest) -> dict:
    try:
        return {"summary": summarize(req.transcript, req.provider, req.model)}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
