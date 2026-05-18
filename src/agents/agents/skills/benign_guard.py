"""Benign skill node.

This node is an explicit optimization and safety mechanism:
- avoids spending tokens on traffic already classified as benign;
- keeps downstream schema unchanged (`assessment` is always structured);
- prevents accidental escalation caused by uncertain LLM fallback behavior.
"""

from __future__ import annotations

from typing import Any, Dict

from src.agents.core.circuit_breaker import assert_skill_invariants
from src.agents.core.handoffs import PlanStatus, append_handoff, make_handoff
from src.agents.core.helpers import get_binary_attack, get_multiclass_label


async def benign_guard_skill(state: Dict[str, Any]) -> Dict[str, Any]:
    """Return deterministic low-risk assessment for benign traffic."""
    gnn = state.get("input", {}).get("gnn_metadata", {})
    label = get_multiclass_label(gnn)
    confidence = float(gnn.get("confidence_score", 0.5))
    binary_attack = get_binary_attack(gnn)

    state["assessment"] = {
        "threat_type": label,
        "threat_subtype": "Benign network behavior",
        "threat_level": "none",
        "confidence_adjusted": confidence,
        "is_real_threat": False,
        "false_positive_probability": min(1.0, max(0.0, 1.0 - confidence)),
        "key_indicators": [
            "GNN binary classifier marked traffic as benign.",
            "No suspicious enrichment required for this flow.",
        ],
        "recommended_actions": [
            "No escalation required.",
            "Keep passive monitoring and include in baseline metrics.",
        ],
        "iocs": [],
        "technical_detail": "Flow was classified as benign and bypassed expensive analysis path.",
    }

    # Self-diagnostic: router never should have routed an attack here.
    if binary_attack == 1:
        state["errors"] = state.get("errors", []) + [
            "benign_guard: routed an alert with binary_attack=1 — possible router misclassification."
        ]

    handoff = make_handoff(
        stage="skill:benign_guard",
        from_agent="benign_guard",
        to_agent="rag_enrichment",
        task="Pass-through enrichment for benign flow.",
        scope=["assessment", "input"],
        accumulated_context={
            "label_multiclase": label,
            "confidence_score": confidence,
            "binary_attack": binary_attack,
        },
        constraints=[
            "Validate cache / prior-assessment existence before re-computing.",
            "Do not invoke any LLM in this branch.",
        ],
        attention_points=[
            "Benign branch — RAG enrichment may emit PLAN_VACIO.",
        ],
        plan_status=PlanStatus.OK if binary_attack == 0 else PlanStatus.ERROR,
        reason=None if binary_attack == 0 else "Misrouted attack flow into benign_guard.",
    )
    append_handoff(state, handoff)
    assert_skill_invariants(state, "benign_guard")
    return state
