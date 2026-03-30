"""ASTOLE — Skill node: Generic."""

from __future__ import annotations

from typing import Any, Dict

from src.agents.agents.skills.base_skill import run_skill
from src.agents.prompts import load_prompt, load_rag_query

_SYSTEM_PROMPT = load_prompt("generic")
_RAG_QUERY = load_rag_query("generic")


async def generic_skill(state: Dict[str, Any]) -> Dict[str, Any]:
    """Specialized skill for Generic (cryptographic and unclassified) attacks."""
    return await run_skill(
        state=state,
        skill_name="generic",
        system_prompt=_SYSTEM_PROMPT,
        rag_query_template=_RAG_QUERY,
    )
