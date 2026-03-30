"""ASTOLE — LangGraph triage pipeline assembly.

Flow:
  router → [specialized skill] → summarizer → END

The router decides which skill to activate based on the GNN label.
Each skill analyzes the alert with its specialized prompt + RAG context.
The summarizer generates the final hierarchical narrative.
"""

from __future__ import annotations

from typing import Any, Dict

from langgraph.graph import END, StateGraph

from src.agents.agents.router import router_node
from src.agents.agents.skills.dos_fuzzers import dos_fuzzers_skill
from src.agents.agents.skills.exploits_backdoor import exploits_backdoor_skill
from src.agents.agents.skills.generic import generic_skill
from src.agents.agents.skills.recon_analysis import recon_analysis_skill
from src.agents.agents.skills.shellcode_worms import shellcode_worms_skill
from src.agents.agents.summarizer import summarizer_node

SKILL_NODES = [
    "dos_fuzzers",
    "exploits_backdoor",
    "recon_analysis",
    "generic",
    "shellcode_worms",
]


def _route_to_skill(state: Dict[str, Any]) -> str:
    """Conditional edge: route to the skill node activated by the router."""
    skill = state.get("skill_activated", "generic")
    if skill not in set(SKILL_NODES):
        return "generic"
    return skill


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
    graph.add_node("summarizer", summarizer_node)

    # --- Entry point ---
    graph.set_entry_point("router")

    # --- Conditional edges: Router → Skill ---
    graph.add_conditional_edges(
        "router",
        _route_to_skill,
        {name: name for name in SKILL_NODES},
    )

    # --- All skills → Summarizer ---
    for skill in SKILL_NODES:
        graph.add_edge(skill, "summarizer")

    # --- Summarizer → END ---
    graph.add_edge("summarizer", END)

    return graph


# Compiled graph ready to be invoked
triage_graph = build_graph().compile()
