"""Environment-driven configuration for the processing service."""
import os


class Config:
    data_dir = os.environ.get("DATA_DIR", "/data")

    # Whisper
    whisper_device = os.environ.get("WHISPER_DEVICE", "auto")  # auto|cpu|cuda|mps
    whisper_model = os.environ.get("WHISPER_MODEL", "openai/whisper-large-v3")

    # LLM
    llm_provider = os.environ.get("LLM_PROVIDER", "ollama")
    llm_model = os.environ.get("LLM_MODEL", "llama3.1")
    ollama_base_url = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434")
    openai_api_key = os.environ.get("OPENAI_API_KEY", "")
    anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    gemini_api_key = os.environ.get("GEMINI_API_KEY", "")
    openrouter_api_key = os.environ.get("OPENROUTER_API_KEY", "")


config = Config()
