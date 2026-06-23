"""Environment-driven configuration for the processing service."""
import os


class Config:
    data_dir = os.environ.get("DATA_DIR", "/data")

    # Whisper (faster-whisper / CTranslate2)
    whisper_device = os.environ.get("WHISPER_DEVICE", "auto")  # auto|cpu|cuda
    whisper_model = os.environ.get("WHISPER_MODEL", "base")  # base|small|medium|large-v3|distil-large-v3|<path>
    whisper_compute_type = os.environ.get("WHISPER_COMPUTE_TYPE", "")  # "" = auto (int8 on cpu, float16 on gpu)

    # LLM
    llm_provider = os.environ.get("LLM_PROVIDER", "ollama")
    llm_model = os.environ.get("LLM_MODEL", "llama3.1")
    ollama_base_url = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434")
    openai_api_key = os.environ.get("OPENAI_API_KEY", "")
    anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    gemini_api_key = os.environ.get("GEMINI_API_KEY", "")
    openrouter_api_key = os.environ.get("OPENROUTER_API_KEY", "")


config = Config()
