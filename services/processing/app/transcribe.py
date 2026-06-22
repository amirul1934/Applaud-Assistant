"""Whisper transcription.

Foundation skeleton: the device-selection + return shape are real and stable. The actual
`insanely-fast-whisper` call is gated behind an import so the service boots (and the rest of the
stack is testable) even before heavy ML deps/models are installed. Phase 3 makes it real.
"""
from __future__ import annotations

import os

from .config import config


def _pick_device() -> str:
    if config.whisper_device != "auto":
        return config.whisper_device
    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def transcribe(audio_path: str) -> dict:
    if not os.path.exists(audio_path):
        raise FileNotFoundError(audio_path)

    device = _pick_device()
    try:
        from transformers import pipeline  # type: ignore

        pipe = pipeline(
            "automatic-speech-recognition",
            model=config.whisper_model,
            device=device if device != "cpu" else -1,
            return_timestamps=True,
        )
        out = pipe(audio_path)
        chunks = out.get("chunks", [])
        segments = [
            {
                "start": (c.get("timestamp") or [0, 0])[0] or 0,
                "end": (c.get("timestamp") or [0, 0])[1] or 0,
                "text": c.get("text", "").strip(),
            }
            for c in chunks
        ]
        return {"text": out.get("text", "").strip(), "segments": segments, "device": device}
    except ImportError:
        # Deps not installed yet — return an explicit, non-crashing placeholder.
        return {
            "text": "",
            "segments": [],
            "device": device,
            "note": "whisper deps not installed; see services/processing/requirements.txt (Phase 3)",
        }
