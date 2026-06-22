"""Turn a transcript into derivative content via the configured LLM provider."""
from __future__ import annotations

from .providers import complete

SUMMARY_PROMPT = """You are an assistant that summarizes voice recordings.
Given the transcript below, produce a clear, well-structured Markdown summary with:
- a one-line TL;DR
- key points as bullets
- any action items or decisions

Transcript:
\"\"\"
{transcript}
\"\"\"
"""


def summarize(transcript: str, provider: str | None = None, model: str | None = None) -> str:
    return complete(SUMMARY_PROMPT.format(transcript=transcript[:120_000]), provider, model)
