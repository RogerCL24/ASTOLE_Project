"""ASTOLE — Prompt loader for .md skill files."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent


@lru_cache(maxsize=None)
def load_prompt(name: str) -> str:
    """Load the system prompt section from a .md prompt file.

    Extracts everything under the ``## System Prompt`` heading.
    """
    return _extract_section(name, "System Prompt")


@lru_cache(maxsize=None)
def load_rag_query(name: str) -> str:
    """Load the RAG query template section from a .md prompt file.

    Extracts everything under the ``## RAG Query Template`` heading.
    """
    return _extract_section(name, "RAG Query Template")


def _extract_section(name: str, section_name: str) -> str:
    path = _PROMPTS_DIR / f"{name}.md"
    content = path.read_text(encoding="utf-8")
    pattern = rf"^## {re.escape(section_name)}\s*\n(.*?)(?=^## |\Z)"
    match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
    if not match:
        raise ValueError(
            f"Section '## {section_name}' not found in {path.name}"
        )
    return match.group(1).strip()
