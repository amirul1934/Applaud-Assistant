"""Derivative content from a transcript via the configured LLM provider: summary, flashcards, Q&A."""
from __future__ import annotations

import json
import re

from .providers import complete

_LIMIT = 120_000  # cap transcript size sent to the model

_SUMMARY_PROMPT = """You summarize voice recordings.
Given the transcript below, produce a clear, well-structured Markdown summary with:
- a one-line TL;DR
- key points as bullets
- any action items or decisions

Transcript:
\"\"\"
{transcript}
\"\"\"
"""

_FLASHCARDS_PROMPT = """Create study flashcards from the transcript below.
Return ONLY a JSON array of objects, each {{"front": "question or term", "back": "answer or definition"}}.
No prose, no markdown fences. Produce 5-15 high-quality cards.

Transcript:
\"\"\"
{transcript}
\"\"\"
"""

_QA_PROMPT = """Generate question-and-answer pairs that test understanding of the transcript below.
Return ONLY a JSON array of objects, each {{"question": "...", "answer": "..."}}.
No prose, no markdown fences.

Transcript:
\"\"\"
{transcript}
\"\"\"
"""


def summarize(transcript: str, provider: str | None = None, model: str | None = None) -> str:
    return complete(_SUMMARY_PROMPT.format(transcript=transcript[:_LIMIT]), provider, model)


def flashcards(transcript: str, provider: str | None = None, model: str | None = None) -> list:
    raw = complete(_FLASHCARDS_PROMPT.format(transcript=transcript[:_LIMIT]), provider, model)
    return _extract_json_array(raw)


def qa(transcript: str, provider: str | None = None, model: str | None = None) -> list:
    raw = complete(_QA_PROMPT.format(transcript=transcript[:_LIMIT]), provider, model)
    return _extract_json_array(raw)


def _extract_json_array(raw: str) -> list:
    """Pull a JSON array out of an LLM response that may wrap it in prose or ``` fences."""
    if not raw:
        return []
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    # Try the whole string, then the first balanced [...] block — robust against trailing prose
    # that itself contains brackets (which a naive rfind("]") would wrongly include).
    for candidate in _json_array_candidates(text):
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            return data
    return []


def _json_array_candidates(text: str):
    yield text
    start = text.find("[")
    if start == -1:
        return
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                yield text[start : i + 1]
                return
