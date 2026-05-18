"""ASTOLE — Circuit breakers for pipeline nodes.

Each pipeline stage has a strictly bounded responsibility. Circuit breakers
verify, before a node returns control to the orchestrator, that the node has
NOT crossed into another stage's territory.

These checks are:

- defensive: they raise warnings (and log to LangSmith via the standard
  logger) when a stage produces something it should not;
- non-fatal: a breached breaker does not abort the pipeline — it records the
  violation in ``state["circuit_violations"]`` and lets the summarizer flag
  the alert as degraded.

The breakers operate on the AgentState dict, so they are usable from any
LangGraph node without coupling to a specific framework.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List

logger = logging.getLogger(__name__)


def _record_violation(state: Dict[str, Any], stage: str, message: str) -> None:
    violations = list(state.get("circuit_violations", []))
    entry = f"[{stage}] {message}"
    violations.append(entry)
    state["circuit_violations"] = violations
    logger.warning("circuit_breaker violation: %s", entry)


def assert_router_invariants(state: Dict[str, Any]) -> None:
    """Guardrails after the router node has executed.

    The router MUST set ``skill_activated`` and ``confidence_tier``. It must
    NOT touch ``assessment``, ``rag_context`` or ``triage_output``.
    """
    if "skill_activated" not in state or not state["skill_activated"]:
        _record_violation(state, "router", "missing skill_activated")
    if "confidence_tier" not in state or not state["confidence_tier"]:
        _record_violation(state, "router", "missing confidence_tier")
    if state.get("assessment"):
        _record_violation(state, "router", "router wrote assessment (skill territory)")
    if state.get("triage_output"):
        _record_violation(state, "router", "router wrote triage_output (summarizer territory)")


def assert_skill_invariants(state: Dict[str, Any], skill: str) -> None:
    """Guardrails after a skill node has executed."""
    if not state.get("assessment"):
        _record_violation(state, skill, "missing assessment")
    if state.get("triage_output"):
        _record_violation(state, skill, "skill wrote triage_output (summarizer territory)")


def assert_rag_invariants(state: Dict[str, Any]) -> None:
    """Guardrails after the RAG enrichment node has executed."""
    if state.get("triage_output"):
        _record_violation(state, "rag_enrichment", "rag wrote triage_output (summarizer territory)")
    if "rag_snippets_count" not in state:
        _record_violation(state, "rag_enrichment", "missing rag_snippets_count")


def assert_summarizer_invariants(state: Dict[str, Any]) -> None:
    """Guardrails after the summarizer node has executed."""
    if not state.get("triage_output"):
        _record_violation(state, "summarizer", "missing triage_output")
    output = state.get("triage_output") or {}
    narrative = output.get("narrative") or {}
    for required in ("executive", "tactical", "impact"):
        if not narrative.get(required):
            _record_violation(state, "summarizer", f"narrative missing field '{required}'")


def collect_violations(state: Dict[str, Any]) -> List[str]:
    """Return all recorded circuit-breaker violations (for tests)."""
    return list(state.get("circuit_violations", []))


def has_violations(state: Dict[str, Any], stages: Iterable[str] | None = None) -> bool:
    """Return True if any violation has been recorded for given stages.

    If ``stages`` is None, returns True if any violation exists.
    """
    violations = state.get("circuit_violations", [])
    if not stages:
        return bool(violations)
    stages = set(stages)
    return any(v.startswith(f"[{s}]") for v in violations for s in stages)
