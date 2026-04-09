"""LangGraph node for external RAG enrichment.

RAG is intentionally modeled as an external layer, not as internal memory,
to respect architectural separation between:
- Engineer 2: triage orchestration and reasoning;
- Engineer 3: organizational memory service and retrieval backend.
"""

from __future__ import annotations

from typing import Any, Dict

from src.agents.core.helpers import get_multiclass_label
from src.agents.tools.rag_tool import rag_retrieve_with_count


async def rag_enrichment_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Retrieve extra context from external RAG and append to state."""
    input_data = state.get("input", {})
    net = input_data.get("network_data", {})
    gnn = input_data.get("gnn_metadata", {})
    label = get_multiclass_label(gnn)
    skill = state.get("skill_activated", "unknown")

    # Small contextual query focused on correlation signals for final synthesis.
    query = (
        f"Correlate {label} indicators for source {net.get('src_ip')} and "
        f"destination {net.get('dst_ip')}:{net.get('dst_port')} "
        f"under skill {skill}. Return recent enterprise-relevant evidence."
    )

    extra_context, extra_count = await rag_retrieve_with_count(query, top_k=3)
    existing_context = state.get("rag_context", "")

    if existing_context and extra_context:
        state["rag_context"] = f"{existing_context}\n---\n{extra_context}"
    elif extra_context:
        state["rag_context"] = extra_context

    state["rag_snippets_count"] = int(state.get("rag_snippets_count", 0)) + extra_count
    return state
