"""Recon/Analysis specialized skill entrypoint.

This node covers pre-exploitation behaviors such as probing, scanning and
application reconnaissance. It is tuned to reduce false positives from
legitimate monitoring traffic by relying on contextual and temporal cues.
"""

from __future__ import annotations

from typing import Any, Dict

from src.agents.agents.skills.base_skill import run_skill
from src.agents.prompts import load_prompt, load_rag_query

_SYSTEM_PROMPT = load_prompt("recon_analysis")
_RAG_QUERY = load_rag_query("recon_analysis")


async def recon_analysis_skill(state: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Recon/Analysis assessment path."""
    return await run_skill(
        state=state,
        skill_name="recon_analysis",
        system_prompt=_SYSTEM_PROMPT,
        rag_query_template=_RAG_QUERY,
    )
