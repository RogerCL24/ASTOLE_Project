"""ASTOLE — Central configuration for LiteLLM, models, and settings.

Uses python-dotenv to load API keys from .env.
LiteLLM acts as unified proxy: abstracts OpenAI, Anthropic, etc.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root
_env_path = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_env_path)


# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------

OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

# ---------------------------------------------------------------------------
# Models per role (quality-cost strategy)
# ---------------------------------------------------------------------------

# Router fallback — only when GNN label doesn't map directly
ROUTER_MODEL: str = os.getenv("ROUTER_MODEL", "gpt-4o-mini")
ROUTER_TEMPERATURE: float = 0.0
ROUTER_MAX_TOKENS: int = 50

# Skills — in-depth analysis of each attack type
SKILL_MODEL: str = os.getenv("SKILL_MODEL", "claude-3-5-haiku-20241022")
SKILL_TEMPERATURE: float = 0.1
SKILL_MAX_TOKENS: int = 1024

# Summarizer — hierarchical summary of the assessment
SUMMARIZER_MODEL: str = os.getenv("SUMMARIZER_MODEL", "gpt-4o-mini")
SUMMARIZER_TEMPERATURE: float = 0.2
SUMMARIZER_MAX_TOKENS: int = 800

# ---------------------------------------------------------------------------
# Confidence-based routing thresholds
# ---------------------------------------------------------------------------

CONFIDENCE_FAST_THRESHOLD: float = float(os.getenv("CONFIDENCE_FAST", "0.90"))
CONFIDENCE_DEEP_THRESHOLD: float = float(os.getenv("CONFIDENCE_DEEP", "0.70"))

# ---------------------------------------------------------------------------
# RAG / ChromaDB (Engineer 3)
# ---------------------------------------------------------------------------

RAG_API_URL: str = os.getenv("RAG_API_URL", "http://localhost:8001")
RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", "5"))
RAG_TIMEOUT_S: int = int(os.getenv("RAG_TIMEOUT_S", "5"))

# ---------------------------------------------------------------------------
# Cache (Redis)
# ---------------------------------------------------------------------------

REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL_S: int = int(os.getenv("CACHE_TTL_S", "60"))
CACHE_ENABLED: bool = os.getenv("CACHE_ENABLED", "false").lower() == "true"

# ---------------------------------------------------------------------------
# FastAPI settings
# ---------------------------------------------------------------------------

API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
API_PORT: int = int(os.getenv("API_PORT", "8000"))
API_WORKERS: int = int(os.getenv("API_WORKERS", "1"))


# ---------------------------------------------------------------------------
# LiteLLM setup
# ---------------------------------------------------------------------------

def setup_litellm() -> None:
    """Configure LiteLLM with the available API keys."""
    import litellm

    litellm.openai_key = OPENAI_API_KEY
    litellm.anthropic_key = ANTHROPIC_API_KEY
    litellm.set_verbose = os.getenv("LITELLM_VERBOSE", "false").lower() == "true"
