"""LangGraph triage pipeline assembly.

Pipeline stages:
1) `router`: deterministic + fallback classification to choose a skill;
2) specialized skill node: attack-family reasoning and initial assessment;
3) `rag_enrichment`: additional external context retrieval;
4) `summarizer`: final hierarchical report and output contract synthesis.

This file deliberately contains only orchestration concerns; node-specific
logic is kept inside each node module.
"""

from __future__ import annotations

from langgraph.graph import END, StateGraph

from src.agents.agents.router import router_node
from src.agents.agents.skills.benign_guard import benign_guard_skill
from src.agents.agents.skills.dos_fuzzers import dos_fuzzers_skill
from src.agents.agents.skills.exploits_backdoor import exploits_backdoor_skill
from src.agents.agents.skills.generic import generic_skill
from src.agents.agents.skills.recon_analysis import recon_analysis_skill
from src.agents.agents.skills.shellcode_worms import shellcode_worms_skill
from src.agents.agents.summarizer import summarizer_node
from src.agents.graph.helpers import route_to_skill
from src.agents.graph.rag_node import rag_enrichment_node

SKILL_NODES = [
    "dos_fuzzers",
    "exploits_backdoor",
    "recon_analysis",
    "generic",
    "shellcode_worms",
    "benign_guard",
]


def build_graph() -> StateGraph:
    """Build and return the compiled LangGraph triage graph."""
    graph = StateGraph(dict)

    # --- Nodes ---
    graph.add_node("router", router_node)
    graph.add_node("dos_fuzzers", dos_fuzzers_skill)
    graph.add_node("exploits_backdoor", exploits_backdoor_skill)
    graph.add_node("recon_analysis", recon_analysis_skill)
    graph.add_node("generic", generic_skill)
    graph.add_node("shellcode_worms", shellcode_worms_skill)
    graph.add_node("benign_guard", benign_guard_skill)
    graph.add_node("rag_enrichment", rag_enrichment_node)
    graph.add_node("summarizer", summarizer_node)

    # --- Entry point ---
    graph.set_entry_point("router")

    # --- Conditional edges: Router → Skill ---
    graph.add_conditional_edges(
        "router",
        lambda state: route_to_skill(state, SKILL_NODES),
        {name: name for name in SKILL_NODES},
    )

    # --- All skills -> external RAG layer ---
    for skill in SKILL_NODES:
        graph.add_edge(skill, "rag_enrichment")

    # --- RAG layer -> Summarizer ---
    graph.add_edge("rag_enrichment", "summarizer")

    # --- Summarizer → END ---
    graph.add_edge("summarizer", END)

    return graph


# Compiled graph ready to be invoked
triage_graph = build_graph().compile()
