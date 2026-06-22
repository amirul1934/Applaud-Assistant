"""LLM provider abstraction.

One `complete(prompt)` entrypoint that dispatches to the configured provider. Each branch lazily
imports its SDK so only the providers you actually use need to be installed. Ollama works over
plain HTTP with no extra dependency.
"""
from __future__ import annotations

import httpx

from .config import config


def complete(prompt: str, provider: str | None = None, model: str | None = None) -> str:
    provider = (provider or config.llm_provider).lower()
    model = model or config.llm_model

    if provider == "ollama":
        return _ollama(prompt, model)
    if provider == "openai":
        return _openai(prompt, model)
    if provider == "anthropic":
        return _anthropic(prompt, model)
    if provider == "gemini":
        return _gemini(prompt, model)
    if provider == "openrouter":
        return _openrouter(prompt, model)
    raise ValueError(f"unknown provider: {provider}")


def _ollama(prompt: str, model: str) -> str:
    r = httpx.post(
        f"{config.ollama_base_url}/api/generate",
        json={"model": model, "prompt": prompt, "stream": False},
        timeout=600,
    )
    r.raise_for_status()
    return r.json().get("response", "")


def _openai(prompt: str, model: str) -> str:
    from openai import OpenAI  # type: ignore

    client = OpenAI(api_key=config.openai_api_key)
    resp = client.chat.completions.create(
        model=model or "gpt-4o-mini", messages=[{"role": "user", "content": prompt}]
    )
    return resp.choices[0].message.content or ""


def _anthropic(prompt: str, model: str) -> str:
    import anthropic  # type: ignore

    client = anthropic.Anthropic(api_key=config.anthropic_api_key)
    resp = client.messages.create(
        model=model or "claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(block.text for block in resp.content if block.type == "text")


def _gemini(prompt: str, model: str) -> str:
    import google.generativeai as genai  # type: ignore

    genai.configure(api_key=config.gemini_api_key)
    resp = genai.GenerativeModel(model or "gemini-1.5-pro").generate_content(prompt)
    return resp.text


def _openrouter(prompt: str, model: str) -> str:
    r = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {config.openrouter_api_key}"},
        json={"model": model, "messages": [{"role": "user", "content": prompt}]},
        timeout=600,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]
