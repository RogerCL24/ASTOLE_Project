"""Shared skill execution runtime.

Every specialized skill delegates to this module to guarantee:
- consistent prompt framing and response schema;
- deterministic fallback behavior when model output is invalid;
- centralized token/model accounting for observability and cost tracking;
- homogeneous RAG access pattern before summarization.

Parallelism within a skill super-step
-------------------------------------
Inside ``run_skill`` we run three independent jobs **concurrently** with
``asyncio.gather``:

1. RAG pre-fetch (organisational context from ChromaDB).
2. Threat-intelligence look-ups (MITRE ATT&CK, IP reputation, optional CVE).
3. Subagent micro-checks (deterministic heuristics over the alert).

Only when all three are ready we call the LLM once with a richer prompt.
This keeps end-to-end latency close to the slowest of the three jobs
instead of summing them sequentially.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, List

from litellm import acompletion

from src.agents.agents.skills.subagents import (
    SKILL_SUBAGENTS,
    SubagentResult,
    run_subagents,
    summarize_subagents,
)
from src.agents.core.circuit_breaker import assert_skill_invariants
from src.agents.core.config import SKILL_MAX_TOKENS, SKILL_MODEL, SKILL_TEMPERATURE
from src.agents.core.handoffs import PlanStatus, append_handoff, make_handoff
from src.agents.core.helpers import get_multiclass_label
from src.agents.tools.external_intel import (
    cve_lookup,
    ip_reputation_lookup,
    mitre_attack_lookup,
)
from src.agents.tools.rag_tool import rag_retrieve_with_count

logger = logging.getLogger(__name__)

# JSON schema that all skills must return
_RESPONSE_SCHEMA = """{
  "threat_type": "string",
  "threat_subtype": "string (more specific)",
  "threat_level": "critical|high|medium|low|none",
  "confidence_adjusted": 0.0-1.0,
  "is_real_threat": true/false,
  "false_positive_probability": 0.0-1.0,
  "key_indicators": ["indicator 1", "indicator 2"],
  "recommended_actions": ["action 1", "action 2"],
  "iocs": [{"type": "ip|port|domain", "value": "...", "role": "attacker|victim|target_service"}],
  "technical_detail": "Technical paragraph with the full analysis"
}"""


def _build_network_summary(net: Dict[str, Any]) -> str:
    """Format network data for inclusion in the prompt."""
    proto_map = {6: "TCP", 17: "UDP", 1: "ICMP"}
    proto = proto_map.get(net.get("protocol", 0), f"Proto-{net.get('protocol')}")

    flag_map = [(0x01, "F"), (0x02, "S"), (0x04, "R"), (0x08, "P"), (0x10, "A"), (0x20, "U")]
    flags_int = net.get("tcp_flags", 0)
    flags_str = "".join(letter for mask, letter in flag_map if flags_int & mask) or str(flags_int)

    return (
        f"Src: {net.get('src_ip')}:{net.get('src_port')} → "
        f"Dst: {net.get('dst_ip')}:{net.get('dst_port')} | "
        f"Proto: {proto} | Flags: {flags_str} | "
        f"Duration: {net.get('duration_ms', 0)}ms | "
        f"Bytes in/out: {net.get('in_bytes', 0)}/{net.get('out_bytes', 0)} | "
        f"Pkts in/out: {net.get('in_pkts', 0)}/{net.get('out_pkts', 0)}"
    )


def _build_window_context(window: Dict[str, Any]) -> str:
    """Format window statistics."""
    if not window or window.get("total_flows", 1) <= 1:
        return "Isolated flow (no window context)."
    return (
        f"Window: {window.get('total_flows')} total flows, "
        f"{window.get('attack_flows')} attacks ({window.get('attack_ratio', 0):.1%}), "
        f"{window.get('unique_src_ips')} unique source IPs, "
        f"{window.get('unique_dst_ips')} unique destination IPs."
    )


async def run_skill(
    state: Dict[str, Any],
    skill_name: str,
    system_prompt: str,
    rag_query_template: str,
) -> Dict[str, Any]:
    """
    Execute a specialized skill:
    1. Build specific RAG query and query ChromaDB
    2. Adjust depth based on confidence tier
    3. Call LLM with specialized prompt + context
    4. Parse JSON response and update state

    Args:
        state: LangGraph graph state (dict)
        skill_name: Skill name (for logging)
        system_prompt: Skill-specific system prompt
        rag_query_template: RAG query template (uses {src_ip}, {dst_ip}, etc.)
    """
    input_data = state["input"]
    net = input_data.get("network_data", {})
    gnn = input_data.get("gnn_metadata", {})
    window = input_data.get("window_stats", {})
    tier = state.get("confidence_tier", "standard")

    # 1. Build specific RAG query
    rag_query = rag_query_template.format(
        src_ip=net.get("src_ip", "unknown"),
        dst_ip=net.get("dst_ip", "unknown"),
        dst_port=net.get("dst_port", 0),
        label=get_multiclass_label(gnn),
    )

    # Adjust RAG depth per tier
    rag_k = {"fast": 2, "standard": 5, "deep": 10}.get(tier, 5)

    # 2. Run RAG pre-fetch + external intelligence in parallel.
    # The three coroutines are independent; we only need their results
    # to enrich the prompt + the subagent inputs, so gather is enough.
    label = get_multiclass_label(gnn)
    rag_task = rag_retrieve_with_count(rag_query, top_k=rag_k)
    mitre_task = mitre_attack_lookup(label)
    iprep_task = ip_reputation_lookup(net.get("src_ip", "") or "")
    cve_task = cve_lookup(net.get("l7_proto"), net.get("dst_port"))

    (rag_context, rag_count), mitre, iprep, cves = await asyncio.gather(
        rag_task, mitre_task, iprep_task, cve_task
    )
    state["rag_context"] = rag_context
    state["rag_snippets_count"] = rag_count
    state["intel"] = {
        "mitre": mitre.data,
        "ip_reputation": iprep.data,
        "cve": cves.data,
        "sources": {
            "mitre": mitre.source,
            "ip_reputation": iprep.source,
            "cve": cves.source,
        },
    }

    # 3. Run the skill's subagents in parallel — they are pure functions,
    # but we keep the gather() interface to mirror the L2 contract.
    sub_catalogue = SKILL_SUBAGENTS.get(skill_name, {})
    intel_for_subs = {
        "ip_reputation": iprep.data,
        "rag_snippets_count": rag_count,
    }
    sub_results: List[SubagentResult] = await run_subagents(
        sub_catalogue, input_data, intel_for_subs
    )
    sub_summary = summarize_subagents(sub_results)
    state.setdefault("subagent_results", {})[skill_name] = sub_summary

    # 4. Build prompt
    network_summary = _build_network_summary(net)
    window_context = _build_window_context(window)
    top_features_str = json.dumps(input_data.get("top_features", {}), indent=2)
    intel_block = _format_intel_block(state["intel"])
    sub_block = _format_subagents_block(sub_summary)

    depth_instruction = {
        "fast": "Quick analysis: focus on key indicators and classification.",
        "standard": "Standard analysis: evaluate indicators, historical context, and recommend actions.",
        "deep": "Deep analysis: examine each indicator in detail, correlate with historical context, thoroughly evaluate false positives.",
    }.get(tier, "Standard analysis.")

    user_msg = f"""## Network Alert
- ID: {input_data.get('alert_id')}
- GNN Classification: {get_multiclass_label(gnn)} (confidence: {gnn.get('confidence_score', 0):.2f})
- {network_summary}
- {window_context}

## Key GNN Features
{top_features_str}

## Historical Context (ChromaDB)
{rag_context}

## External Intelligence
{intel_block}

## Subagent Evidence
{sub_block}

## Instruction
{depth_instruction}

Respond EXCLUSIVELY with valid JSON following this schema:
{_RESPONSE_SCHEMA}"""

    # 4. Call the LLM
    # Keep default profile under the target average token budget (<800 tokens).
    max_tokens = {"fast": 384, "standard": 768, "deep": 960}.get(tier, SKILL_MAX_TOKENS)

    try:
        response = await acompletion(
            model=SKILL_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            temperature=SKILL_TEMPERATURE,
            max_tokens=max_tokens,
        )

        raw_content = response.choices[0].message.content.strip()

        # Extract JSON if wrapped in markdown
        if "```json" in raw_content:
            raw_content = raw_content.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_content:
            raw_content = raw_content.split("```")[1].split("```")[0].strip()

        assessment = json.loads(raw_content)
        state["assessment"] = assessment

        # Update tokens
        usage = getattr(response, "usage", None)
        tokens = state.get("tokens_used", {})
        tokens["skill"] = getattr(usage, "total_tokens", 0) if usage else 0
        tokens["total"] = tokens.get("total", 0) + tokens["skill"]
        state["tokens_used"] = tokens

        models = state.get("models_used", [])
        if SKILL_MODEL not in models:
            models.append(SKILL_MODEL)
        state["models_used"] = models

        logger.info("Skill %s completed: threat_level=%s", skill_name, assessment.get("threat_level"))

    except json.JSONDecodeError as e:
        logger.error("Skill %s: invalid JSON from LLM: %s", skill_name, e)
        state["assessment"] = _fallback_assessment(gnn, skill_name)
        state["errors"] = state.get("errors", []) + [f"Skill {skill_name}: JSON parse error"]
    except Exception as e:
        logger.error("Skill %s error: %s", skill_name, e)
        state["assessment"] = _fallback_assessment(gnn, skill_name)
        state["errors"] = state.get("errors", []) + [f"Skill {skill_name}: {str(e)}"]

    # --- Skill -> rag_enrichment handoff + circuit breaker ---
    skill_errors = [e for e in state.get("errors", []) if skill_name in e]
    plan_status = PlanStatus.ERROR if skill_errors else PlanStatus.OK
    handoff = make_handoff(
        stage=f"skill:{skill_name}",
        from_agent=skill_name,
        to_agent="rag_enrichment",
        task="Enrich assessment with external organizational context.",
        scope=["assessment", "input"],
        accumulated_context={
            "threat_level": state["assessment"].get("threat_level"),
            "is_real_threat": state["assessment"].get("is_real_threat"),
            "rag_context_pre_enrichment_chars": len(state.get("rag_context") or ""),
            "rag_snippets_pre_enrichment": state.get("rag_snippets_count", 0),
        },
        constraints=[
            "Validate cache / prior-assessment existence before re-computing.",
            "Do not modify assessment fields after this point.",
        ],
        attention_points=[
            "If RAG service is unavailable, summarizer must note degraded mode.",
        ],
        plan_status=plan_status,
        reason=skill_errors[-1] if skill_errors else None,
    )
    append_handoff(state, handoff)
    assert_skill_invariants(state, skill_name)
    return state


def _fallback_assessment(gnn: Dict[str, Any], skill_name: str) -> Dict[str, Any]:
    """Fallback assessment when the LLM fails."""
    return {
        "threat_type": get_multiclass_label(gnn),
        "threat_subtype": "Analysis unavailable",
        "threat_level": "medium",
        "confidence_adjusted": gnn.get("confidence_score", 0.5),
        "is_real_threat": gnn.get("confidence_score", 0.5) > 0.7,
        "false_positive_probability": 1.0 - gnn.get("confidence_score", 0.5),
        "key_indicators": ["Automated analysis unavailable — manual review required"],
        "recommended_actions": ["Manual review required", f"Skill {skill_name} failed to process"],
        "iocs": [],
        "technical_detail": f"Skill {skill_name} could not complete the analysis. Manual review recommended.",
    }


def _format_intel_block(intel: Dict[str, Any]) -> str:
    """Render the external-intel payload in a compact prompt block."""
    if not intel:
        return "(no external intelligence available)"
    mitre = intel.get("mitre", {}) or {}
    iprep = intel.get("ip_reputation", {}) or {}
    cve = intel.get("cve", {}) or {}
    techniques = ", ".join(
        f"{t.get('id')}/{t.get('name')}" for t in mitre.get("techniques", [])[:3]
    ) or "—"
    cves = ", ".join(cve.get("cves", [])[:3]) or "—"
    return (
        f"- MITRE ATT&CK: {techniques}\n"
        f"- IP reputation: score={iprep.get('score', 'n/a')}, "
        f"category={iprep.get('category', 'n/a')}\n"
        f"- Candidate CVEs ({cve.get('service') or 'unknown service'}): {cves}"
    )


def _format_subagents_block(summary: Dict[str, Any]) -> str:
    """Render the aggregated subagent verdicts for the prompt."""
    if not summary:
        return "(no subagents executed)"
    matched = ", ".join(summary.get("matched", [])) or "(none)"
    return (
        f"- Subagents executed: {', '.join(summary.get('ran', [])) or '—'}\n"
        f"- Matched: {matched} (avg conf {summary.get('avg_match_confidence', 0):.2f})"
    )
