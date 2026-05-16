"""ASTOLE — Agent graph state definition (TypedDict for LangGraph)."""

from __future__ import annotations

from typing import Any, Dict, List, TypedDict


class AgentState(TypedDict, total=False):
    """State shared between all LangGraph nodes.

    Core triage keys:
        input:              Original alert payload (InputAlert dict).
        skill_activated:    Name of the skill node chosen by the router.
        confidence_tier:    "fast" | "standard" | "deep".
        rag_context:        Concatenated RAG snippets from ChromaDB.
        rag_snippets_count: Number of RAG snippets retrieved.
        assessment:         Structured output from the activated skill.
        tokens_used:        Token counters per component.
        cost_usd:           Accumulated LLM cost in USD.
        models_used:        List of model identifiers used in the pipeline.
        cache_hit:          Whether the result was served from cache.
        processing_start:   ISO timestamp when processing began.
        errors:             List of error messages accumulated during the run.
        triage_output:      Final TriageOutput dict for the Dashboard.

    Pipeline observability keys:
        handoffs:            Ordered list of structured handoffs (5-block).
        plan_statuses:       Map stage -> "OK"|"PLAN_VACIO"|"ERROR".
        circuit_violations:  Recorded by core.circuit_breaker assertions.

    Sub-agent / external intelligence keys:
        subagent_results:    Map skill_name -> aggregated subagent summary
                             (see ``agents.skills.subagents.summarize_subagents``).
        intel:               Aggregated external-intelligence payload
                             (MITRE ATT&CK, IP reputation, CVE candidates).
    """

    input: Dict[str, Any]
    skill_activated: str
    confidence_tier: str
    rag_context: str
    rag_snippets_count: int
    assessment: Dict[str, Any]
    tokens_used: Dict[str, int]
    cost_usd: float
    models_used: List[str]
    cache_hit: bool
    processing_start: str
    errors: List[str]
    triage_output: Dict[str, Any]

    handoffs: List[Dict[str, Any]]
    plan_statuses: Dict[str, str]
    circuit_violations: List[str]

    subagent_results: Dict[str, Dict[str, Any]]
    intel: Dict[str, Any]
