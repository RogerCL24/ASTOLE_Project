"""DoS/Fuzzers specialized skill entrypoint.

This thin node delegates heavy lifting to `run_skill` while preserving a clear
domain boundary in the graph. Grouping DoS and Fuzzers is intentional because
both often share traffic-shape indicators (high volume, asymmetric flow, burst
patterns) and benefit from similar contextual retrieval strategies.
"""

from __future__ import annotations

from typing import Any, Dict

from src.agents.agents.skills.base_skill import run_skill
from src.agents.prompts import load_prompt, load_rag_query

_SYSTEM_PROMPT = load_prompt("dos_fuzzers")
_RAG_QUERY = load_rag_query("dos_fuzzers")


async def dos_fuzzers_skill(state: Dict[str, Any]) -> Dict[str, Any]:
    """Execute DoS/Fuzzers analysis with dedicated prompt and RAG query."""
    return await run_skill(
        state=state,
        skill_name="dos_fuzzers",
        system_prompt=_SYSTEM_PROMPT,
        rag_query_template=_RAG_QUERY,
    )
