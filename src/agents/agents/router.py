"""Router node for ASTOLE LangGraph.

Design goals:
- Keep routing deterministic and cheap for known labels (rule path).
- Preserve robustness for unseen labels (LLM fallback path).
- Classify processing depth early (`fast`, `standard`, `deep`) so downstream
  skills can adapt token budget and RAG depth.

The router is intentionally conservative:
- benign traffic short-circuits to a minimal skill (`benign_guard`);
- unknown labels never block the pipeline and degrade to `generic`.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from litellm import acompletion

from src.agents.core.config import (
    CONFIDENCE_DEEP_THRESHOLD,
    CONFIDENCE_FAST_THRESHOLD,
    ROUTER_MAX_TOKENS,
    ROUTER_MODEL,
    ROUTER_TEMPERATURE,
)
from src.agents.core.helpers import get_binary_attack, get_multiclass_label
from src.agents.prompts import load_prompt

logger = logging.getLogger(__name__)

_ROUTER_SYSTEM_PROMPT = load_prompt("router")

# GNN label → skill node name mapping in the LangGraph graph
SKILL_MAP: Dict[str, str] = {
    "Benign": "benign_guard",
    "DoS": "dos_fuzzers",
    "Fuzzers": "dos_fuzzers",
    "Exploits": "exploits_backdoor",
    "Backdoor": "exploits_backdoor",
    "Reconnaissance": "recon_analysis",
    "Analysis": "recon_analysis",
    "Generic": "generic",
    "Shellcode": "shellcode_worms",
    "Worms": "shellcode_worms",
}

# All valid labels from dataset NF-UNSW-NB15-v3
VALID_LABELS = set(SKILL_MAP.keys())


def _determine_confidence_tier(confidence: float) -> str:
    """Determine the analysis tier based on GNN confidence."""
    if confidence >= CONFIDENCE_FAST_THRESHOLD:
        return "fast"
    elif confidence >= CONFIDENCE_DEEP_THRESHOLD:
        return "standard"
    else:
        return "deep"


async def router_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Router node of the LangGraph graph.

    1. Reads label_multiclass from gnn_metadata
    2. If label is in SKILL_MAP → direct route (0 cost)
    3. Otherwise → LLM fallback to classify
    4. Determines the confidence tier
    """
    # The input contract may be canonical or legacy; helper functions normalize
    # both forms so routing logic remains stable.
    gnn = state["input"]["gnn_metadata"]
    label = get_multiclass_label(gnn)
    confidence = gnn.get("confidence_score", 0.5)
    binary_attack = get_binary_attack(gnn)

    # Confidence tier
    state["confidence_tier"] = _determine_confidence_tier(confidence)

    # Fast path — direct rule (95%+ of cases)
    # Canonical benign flows are explicitly short-circuited to a low-cost skill.
    if binary_attack == 0 or label == "Benign":
        state["skill_activated"] = "benign_guard"
        logger.info("Router: benign flow -> benign_guard (tier=%s)", state["confidence_tier"])
        return state

    if label in SKILL_MAP:
        state["skill_activated"] = SKILL_MAP[label]
        logger.info(
            "Router: %s → %s (rule, tier=%s)",
            label, SKILL_MAP[label], state["confidence_tier"],
        )
        return state

    # LLM fallback — only for unexpected labels
    logger.warning("Router: label '%s' not in SKILL_MAP, using LLM fallback", label)
    try:
        user_msg = (
            f"Alert with binary_attack={binary_attack}, "
            f"label_multiclase={label}, confidence={confidence}. "
            f"Network: protocol={state['input']['network_data'].get('protocol')}, "
            f"dst_port={state['input']['network_data'].get('dst_port')}."
        )

        response = await acompletion(
            model=ROUTER_MODEL,
            messages=[
                {"role": "system", "content": _ROUTER_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=ROUTER_TEMPERATURE,
            max_tokens=ROUTER_MAX_TOKENS,
        )

        predicted_label = response.choices[0].message.content.strip()
        state["models_used"] = state.get("models_used", []) + [ROUTER_MODEL]

        # Update tokens
        usage = getattr(response, "usage", None)
        if usage:
            tokens = state.get("tokens_used", {})
            tokens["router"] = getattr(usage, "total_tokens", 0)
            state["tokens_used"] = tokens

        if predicted_label in SKILL_MAP:
            state["skill_activated"] = SKILL_MAP[predicted_label]
        else:
            # Last resort: generic skill
            logger.error("LLM returned invalid label: '%s' → using generic", predicted_label)
            state["skill_activated"] = "generic"

    except Exception as e:
        logger.error("Router LLM fallback error: %s → using generic", e)
        state["skill_activated"] = "generic"
        state["errors"] = state.get("errors", []) + [f"Router LLM error: {str(e)}"]

    return state
