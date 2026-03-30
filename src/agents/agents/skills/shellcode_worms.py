"""ASTOLE — Skill node: Shellcode / Worms."""

from __future__ import annotations

from typing import Any, Dict

from src.agents.agents.skills.base_skill import run_skill
from src.agents.prompts import load_prompt, load_rag_query

_SYSTEM_PROMPT = load_prompt("shellcode_worms")
_RAG_QUERY = load_rag_query("shellcode_worms")


async def shellcode_worms_skill(state: Dict[str, Any]) -> Dict[str, Any]:
    """Specialized skill for Shellcode and Worms."""
    return await run_skill(
        state=state,
        skill_name="shellcode_worms",
        system_prompt=_SYSTEM_PROMPT,
        rag_query_template=_RAG_QUERY,
    )
