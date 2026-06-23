"""Tests for the LLM analysis layer against a mock Ollama server.

Validates the prompt -> response -> parse pipeline (summary text, flashcards/Q&A JSON extraction
including fenced/prose-wrapped responses and malformed output). No ML/model downloads required.

Run: python test_analyze.py
"""
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer


class _Handler(BaseHTTPRequestHandler):
    reply = ""  # set per-test; returned as Ollama's {"response": ...}

    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        self.rfile.read(length)
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"response": _Handler.reply}).encode())

    def log_message(self, *_):  # silence
        pass


def main():
    server = HTTPServer(("127.0.0.1", 0), _Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]

    # Point the config singleton at the mock before exercising the analysis functions.
    from app.config import config

    config.llm_provider = "ollama"
    config.ollama_base_url = f"http://127.0.0.1:{port}"

    from app import analyze

    # 1) summary returns the model text verbatim
    _Handler.reply = "## TL;DR\n- shipped the thing"
    assert analyze.summarize("hello world") == "## TL;DR\n- shipped the thing"

    # 2) flashcards: fenced JSON is parsed
    _Handler.reply = '```json\n[{"front": "Q1", "back": "A1"}]\n```'
    cards = analyze.flashcards("x")
    assert cards == [{"front": "Q1", "back": "A1"}], cards

    # 3) Q&A: JSON embedded in prose is extracted
    _Handler.reply = 'Sure, here you go:\n[{"question": "q", "answer": "a"}]\nHope that helps!'
    pairs = analyze.qa("x")
    assert pairs == [{"question": "q", "answer": "a"}], pairs

    # 4) malformed output degrades to an empty list, not a crash
    _Handler.reply = "I could not produce JSON."
    assert analyze.flashcards("x") == []

    # 5) trailing prose containing brackets must not break extraction
    _Handler.reply = '[{"front": "X", "back": "Y"}] Note: see item [1] for details.'
    assert analyze.flashcards("x") == [{"front": "X", "back": "Y"}]

    server.shutdown()
    print("test_analyze: 5 passed")


if __name__ == "__main__":
    main()
