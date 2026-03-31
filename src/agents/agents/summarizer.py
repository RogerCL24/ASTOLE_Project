"""ASTOLE — Summarizer Agent.

Takes a skill assessment + original input and produces:
1. Hierarchical narrative (executive → technical → actions)
2. Extracted IOCs
3. Investigation hints for the Chat RAG
4. Final severity and escalation decision

This is the last node before returning TriageOutput to the Dashboard.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from litellm import acompletion

from src.agents.core.config import SUMMARIZER_MAX_TOKENS, SUMMARIZER_MODEL, SUMMARIZER_TEMPERATURE
from src.agents.prompts import load_prompt

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = load_prompt("ciso_responder")

_USER_TEMPLATE = """## Skill Assessment
{assessment_json}

## Original Alert Data
- Alert ID: {alert_id}
- Timestamp: {timestamp}
- Attack type (GNN): {label} (confidence: {confidence:.2f})
- Network: {src_ip}:{src_port} → {dst_ip}:{dst_port} ({protocol})
- Window: {window_context}
- RAG context available: {rag_available}

## Instructions
Generate the report with this JSON schema:
{{
  "executive_summary": "string (1-2 sentences)",
  "technical_detail": "string (technical paragraph)",
  "recommended_actions": ["action 1", "action 2", ...],
  "suggested_queries": ["RAG query 1", "query 2", ...],
  "severity": "critical|high|medium|low|info",
  "should_escalate": true/false,
  "escalation_reason": "string (only if should_escalate=true)"
}}"""


def _map_severity(threat_level: str, confidence: float, attack_flows: int) -> str:
    """Determine severity based on threat_level + additional factors."""
    if threat_level == "critical":
        return "critical"
    if threat_level == "high":
        return "critical" if attack_flows > 10 else "high"
    if threat_level == "medium":
        return "high" if confidence > 0.9 and attack_flows > 5 else "medium"
    if threat_level == "low":
        return "low"
    return "info"


def _should_auto_escalate(
    threat_level: str,
    attack_flows: int,
    label: str,
) -> tuple[bool, str]:
    """Decide if the alert requires automatic escalation."""
    if threat_level == "critical":
        return True, f"Critical threat detected: {label}"
    if label in ("Worms", "Shellcode") and attack_flows > 3:
        return True, f"{label} with {attack_flows} attack flows — possible outbreak"
    if attack_flows > 20:
        return True, f"Massive campaign: {attack_flows} attack flows in window"
    return False, ""


async def summarizer_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Summarizer node of the LangGraph graph.

    Generates the final narrative from the skill assessment.
    """
    input_data = state.get("input", {})
    assessment = state.get("assessment", {})
    net = input_data.get("network_data", {})
    gnn = input_data.get("gnn_metadata", {})
    window = input_data.get("window_stats", {})

    proto_map = {6: "TCP", 17: "UDP", 1: "ICMP"}
    protocol_name = proto_map.get(net.get("protocol", 0), str(net.get("protocol")))

    window_ctx = (
        f"{window.get('total_flows', 1)} flows, "
        f"{window.get('attack_flows', 1)} attacks "
        f"({window.get('attack_ratio', 0):.1%})"
    ) if window else "No window context"

    user_msg = _USER_TEMPLATE.format(
        assessment_json=json.dumps(assessment, ensure_ascii=False, indent=2),
        alert_id=input_data.get("alert_id", "N/A"),
        timestamp=input_data.get("timestamp", "N/A"),
        label=gnn.get("label_multiclass", "Unknown"),
        confidence=gnn.get("confidence_score", 0.0),
        src_ip=net.get("src_ip", "?"),
        src_port=net.get("src_port", 0),
        dst_ip=net.get("dst_ip", "?"),
        dst_port=net.get("dst_port", 0),
        protocol=protocol_name,
        window_context=window_ctx,
        rag_available="Yes" if state.get("rag_context") else "No",
    )

    try:
        response = await acompletion(
            model=SUMMARIZER_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=SUMMARIZER_TEMPERATURE,
            max_tokens=SUMMARIZER_MAX_TOKENS,
        )

        raw = response.choices[0].message.content.strip()
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()

        summary = json.loads(raw)

        # Update tokens
        usage = getattr(response, "usage", None)
        tokens = state.get("tokens_used", {})
        tokens["summarizer"] = getattr(usage, "total_tokens", 0) if usage else 0
        tokens["total"] = tokens.get("total", 0) + tokens["summarizer"]
        state["tokens_used"] = tokens

        models = state.get("models_used", [])
        if SUMMARIZER_MODEL not in models:
            models.append(SUMMARIZER_MODEL)
        state["models_used"] = models

    except Exception as e:
        logger.error("Summarizer error: %s", e)
        summary = _fallback_summary(assessment, input_data)
        state["errors"] = state.get("errors", []) + [f"Summarizer error: {str(e)}"]

    # --- Build TriageOutput ---
    threat_level = assessment.get("threat_level", "medium")
    attack_flows = window.get("attack_flows", 1)

    # NUEVO
    raw_label = gnn.get("label_multiclass", "Unknown")
    label = raw_label.value if hasattr(raw_label, 'value') else str(raw_label)
    
    if "." in label:
        label = label.split(".")[-1]
    # FIN NUEVO --- 

    severity = summary.get("severity", _map_severity(
        threat_level, gnn.get("confidence_score", 0.5), attack_flows
    ))

    auto_escalate, escalation_reason = _should_auto_escalate(
        threat_level, attack_flows, label
    )
    is_escalated = summary.get("should_escalate", auto_escalate)

    now = datetime.now(timezone.utc).isoformat()
    triage_id = f"TRG-{uuid.uuid4().hex[:8].upper()}"

    # IOCs from the assessment
    iocs = assessment.get("iocs", [])
    if not iocs:
        # Generate basic IOCs from network_data
        iocs = [
            {"type": "ip", "value": net.get("src_ip", ""), "role": "attacker"},
            {"type": "ip", "value": net.get("dst_ip", ""), "role": "victim"},
        ]
        if net.get("dst_port"):
            iocs.append({"type": "port", "value": net["dst_port"], "role": "target_service"})

    state["triage_output"] = {
        "triage_id": triage_id,
        "alert_id": input_data.get("alert_id", ""),
        "timestamp_processed": now,
        "severity": severity,
        "is_escalated": is_escalated,
        "assessment": {
            "threat_type": assessment.get("threat_type", label),
            "threat_subtype": assessment.get("threat_subtype", ""),
            "threat_level": threat_level,
            "confidence_adjusted": assessment.get("confidence_adjusted", gnn.get("confidence_score", 0.5)),
            "is_real_threat": assessment.get("is_real_threat", True),
            "false_positive_probability": assessment.get("false_positive_probability", 0.1),
        },
        "narrative": {
            "executive_summary": summary.get("executive_summary", "Analysis unavailable."),
            "technical_detail": summary.get("technical_detail", assessment.get("technical_detail", "")),
            "recommended_actions": summary.get("recommended_actions", assessment.get("recommended_actions", [])),
            "iocs": iocs,
        },
        "context_used": {
            "rag_snippets_count": state.get("rag_snippets_count", 0),
            "historical_alerts_same_ip": 0,  # Populated when real RAG is available
            "related_window_alerts": window.get("attack_flows", 0),
        },
        "skills_activated": [state.get("skill_activated", "unknown")],
        "investigation_hints": {
            "suggested_queries": summary.get("suggested_queries", []),
            "related_alert_ids": [],  # Populated with real correlation
        },
        "metadata": {
            "processing_time_ms": 0,  # Calculated in main.py
            "tokens_used": state.get("tokens_used", {}),
            "cost_usd": state.get("cost_usd", 0.0),
            "models_used": state.get("models_used", []),
            "cache_hit": state.get("cache_hit", False),
        },
    }

    return state


def _fallback_summary(assessment: Dict[str, Any], input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Fallback summary when the summarizer LLM fails."""
    label = input_data.get("gnn_metadata", {}).get("label_multiclass", "Unknown")
    src_ip = input_data.get("network_data", {}).get("src_ip", "?")
    dst_ip = input_data.get("network_data", {}).get("dst_ip", "?")
    return {
        "executive_summary": f"{label} attack detected from {src_ip} towards {dst_ip}. "
                             f"Threat level: {assessment.get('threat_level', 'medium')}.",
        "technical_detail": assessment.get("technical_detail", "Technical detail unavailable."),
        "recommended_actions": assessment.get("recommended_actions", ["Manual review required"]),
        "suggested_queries": [
            f"What other destinations has {src_ip} recently contacted?",
            f"Are there other attackers targeting {dst_ip}?",
        ],
        "severity": assessment.get("threat_level", "medium"),
        "should_escalate": assessment.get("threat_level") == "critical",
    }
