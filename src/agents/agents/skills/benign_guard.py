"""Benign skill node.

This node is an explicit optimization and safety mechanism:
- avoids spending tokens on traffic already classified as benign;
- keeps downstream schema unchanged (`assessment` is always structured);
- prevents accidental escalation caused by uncertain LLM fallback behavior.
"""

from __future__ import annotations

from typing import Any, Dict

from src.agents.core.helpers import get_multiclass_label


async def benign_guard_skill(state: Dict[str, Any]) -> Dict[str, Any]:
    """Return deterministic low-risk assessment for benign traffic."""
    gnn = state.get("input", {}).get("gnn_metadata", {})
    label = get_multiclass_label(gnn)
    confidence = float(gnn.get("confidence_score", 0.5))

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
    return state
