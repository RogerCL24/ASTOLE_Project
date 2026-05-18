"""ASTOLE — Tests for the handoff + circuit breaker layer."""

from __future__ import annotations

import os

# Force test mode before importing any code that reads env at import time.
os.environ.setdefault("RAG_USE_MOCK", "true")
os.environ.setdefault("CACHE_ENABLED", "false")

from src.agents.core.circuit_breaker import (
    assert_rag_invariants,
    assert_router_invariants,
    assert_skill_invariants,
    assert_summarizer_invariants,
    collect_violations,
    has_violations,
)
from src.agents.core.handoffs import (
    PlanStatus,
    append_handoff,
    make_handoff,
)


class TestHandoffSchema:
    """Validates the structural invariants of the 5-block handoff."""

    def test_existence_validation_constraint_is_auto_inserted(self):
        h = make_handoff(
            stage="router",
            from_agent="router",
            to_agent="dos_fuzzers",
            task="t",
            scope=["a"],
            accumulated_context={"k": "v"},
            constraints=[],
            attention_points=[],
        )
        joined = " ".join(h.constraints).lower()
        assert "existence" in joined

    def test_existence_constraint_not_duplicated_when_present(self):
        h = make_handoff(
            stage="router",
            from_agent="router",
            to_agent="generic",
            task="t",
            constraints=["Validate existence prior to compute."],
        )
        existence_lines = [c for c in h.constraints if "existence" in c.lower()]
        assert len(existence_lines) == 1

    def test_to_dict_serializes_plan_status(self):
        h = make_handoff(
            stage="rag_enrichment",
            from_agent="rag_enrichment",
            to_agent="summarizer",
            task="t",
            plan_status=PlanStatus.PLAN_VACIO,
            reason="empty",
        )
        d = h.to_dict()
        assert d["plan_status"] == "PLAN_VACIO"
        assert d["reason"] == "empty"

    def test_append_handoff_records_status_and_errors(self):
        state: dict = {}
        ok = make_handoff(
            stage="router", from_agent="router", to_agent="generic", task="t"
        )
        bad = make_handoff(
            stage="rag_enrichment",
            from_agent="rag_enrichment",
            to_agent="summarizer",
            task="t",
            plan_status=PlanStatus.ERROR,
            reason="rag offline",
        )
        append_handoff(state, ok)
        append_handoff(state, bad)
        assert len(state["handoffs"]) == 2
        assert state["plan_statuses"] == {
            "router": "OK",
            "rag_enrichment": "ERROR",
        }
        assert any("rag offline" in e for e in state["errors"])


class TestCircuitBreakers:
    """Each stage's invariants must reject obviously wrong outputs."""

    def test_router_invariants_pass(self):
        state = {"skill_activated": "dos_fuzzers", "confidence_tier": "fast"}
        assert_router_invariants(state)
        assert not has_violations(state)

    def test_router_invariants_detect_missing_skill(self):
        state = {"confidence_tier": "fast"}
        assert_router_invariants(state)
        assert has_violations(state, ["router"])

    def test_router_invariants_detect_skill_assessment_leak(self):
        state = {
            "skill_activated": "dos_fuzzers",
            "confidence_tier": "fast",
            "assessment": {"threat_level": "low"},
        }
        assert_router_invariants(state)
        assert any("skill territory" in v for v in collect_violations(state))

    def test_skill_invariants_detect_missing_assessment(self):
        state: dict = {}
        assert_skill_invariants(state, "generic")
        assert has_violations(state, ["generic"])

    def test_rag_invariants_detect_summarizer_leak(self):
        state = {"triage_output": {"foo": "bar"}}
        assert_rag_invariants(state)
        assert has_violations(state, ["rag_enrichment"])

    def test_summarizer_invariants_detect_incomplete_narrative(self):
        state = {
            "triage_output": {
                "narrative": {"executive": "x"},  # missing tactical, impact
            }
        }
        assert_summarizer_invariants(state)
        violations = collect_violations(state)
        assert any("'tactical'" in v for v in violations)
        assert any("'impact'" in v for v in violations)
