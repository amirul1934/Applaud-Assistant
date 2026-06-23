"""Whisper transcription via faster-whisper (CTranslate2).

faster-whisper runs well on CPU (int8) and GPU (float16), returns segment timestamps natively, and
needs no PyTorch on CPU. The model is loaded once and cached. If faster-whisper isn't installed the
function returns an explicit empty placeholder so the rest of the stack still runs and is testable.
"""
from __future__ import annotations

import os

from .config import config

_model = None  # cached faster_whisper.WhisperModel


def _pick_device() -> str:
    if config.whisper_device != "auto":
        return config.whisper_device
    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass
    return "cpu"


def _compute_type(device: str) -> str:
    if config.whisper_compute_type:
        return config.whisper_compute_type
    return "float16" if device == "cuda" else "int8"


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel  # type: ignore

        device = _pick_device()
        _model = WhisperModel(config.whisper_model, device=device, compute_type=_compute_type(device))
    return _model


def transcribe(audio_path: str) -> dict:
    if not os.path.exists(audio_path):
        raise FileNotFoundError(audio_path)

    device = _pick_device()
    try:
        model = _get_model()
    except ImportError:
        # ML deps not installed yet — return an explicit, non-crashing placeholder.
        return {
            "text": "",
            "segments": [],
            "device": device,
            "note": "faster-whisper not installed; uncomment it in services/processing/requirements.txt",
        }

    # vad_filter trims silence so short/sparse recordings transcribe cleanly.
    segments_iter, info = model.transcribe(audio_path, vad_filter=True)
    segments = [
        {"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()}
        for s in segments_iter
    ]
    text = " ".join(s["text"] for s in segments).strip()
    return {
        "text": text,
        "segments": segments,
        "language": getattr(info, "language", None),
        "device": device,
    }
