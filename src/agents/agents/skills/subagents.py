"""ASTOLE — Subagent runtime for skill specialists.

Each L2 specialist (skill) decomposes its work into a small set of
**subagents**. A subagent is a deterministic, lightweight micro-check
(pure function over the alert + intelligence inputs) that:

- runs in parallel with sibling subagents within a skill super-step;
- returns a :class:`SubagentResult` with verdict + evidence;
- never calls the LLM (subagents are *features* the LLM consumes, not
  themselves model calls).

The skill node aggregates all subagent results into ``state["subagent_results"]``
and forwards them to the LLM prompt as structured evidence. This mirrors
Terry-2.0's L1→L2 fan-out where the planner (here, the skill) delegates
several atomic tasks to its executors and merges their outputs.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Sequence

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass
class SubagentResult:
    """Outcome of a single subagent execution."""

    name: str
    verdict: str  # "match" | "no_match" | "indeterminate"
    confidence: float  # 0.0 – 1.0
    evidence: Dict[str, Any] = field(default_factory=dict)
    error: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


SubagentFn = Callable[[Dict[str, Any], Dict[str, Any]], "SubagentResult | Awaitable[SubagentResult]"]


# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------


async def run_subagents(
    name_to_fn: Dict[str, SubagentFn],
    alert: Dict[str, Any],
    intel: Dict[str, Any],
) -> List[SubagentResult]:
    """Run the given subagents concurrently and return their results.

    Subagent failures are caught and surfaced as ``verdict="indeterminate"``
    so a faulty heuristic never blocks the pipeline.
    """

    async def _runner(sub_name: str, fn: SubagentFn) -> SubagentResult:
        try:
            res = fn(alert, intel)
            if asyncio.iscoroutine(res):
                res = await res
            return res  # type: ignore[return-value]
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Subagent '%s' raised: %s", sub_name, exc)
            return SubagentResult(
                name=sub_name,
                verdict="indeterminate",
                confidence=0.0,
                error=str(exc),
            )

    coros = [_runner(name, fn) for name, fn in name_to_fn.items()]
    return list(await asyncio.gather(*coros))


def summarize_subagents(results: Sequence[SubagentResult]) -> Dict[str, Any]:
    """Compact summary the LLM prompt can consume directly."""
    matches = [r.name for r in results if r.verdict == "match"]
    avg_conf = (
        sum(r.confidence for r in results if r.verdict == "match") / max(len(matches), 1)
        if matches
        else 0.0
    )
    return {
        "ran": [r.name for r in results],
        "matched": matches,
        "avg_match_confidence": round(avg_conf, 3),
        "details": [r.to_dict() for r in results],
    }


# ---------------------------------------------------------------------------
# Reusable subagent implementations
# ---------------------------------------------------------------------------


# Common reverse-shell / backdoor default ports. Source: pen-testing folklore.
_SUSPICIOUS_PORTS = {4444, 1337, 31337, 8888, 9999, 5555, 6666, 12345}


def _net(alert: Dict[str, Any]) -> Dict[str, Any]:
    return alert.get("network_data", {}) or {}


def _gnn(alert: Dict[str, Any]) -> Dict[str, Any]:
    return alert.get("gnn_metadata", {}) or {}


def _window(alert: Dict[str, Any]) -> Dict[str, Any]:
    return alert.get("window_stats", {}) or {}


def volumetric_check(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """High pps / strong asymmetry → DoS-like pattern."""
    net = _net(alert)
    in_pkts = int(net.get("in_pkts", 0) or 0)
    out_pkts = int(net.get("out_pkts", 0) or 0)
    duration_ms = float(net.get("duration_ms", 0) or 0)
    duration_s = max(duration_ms / 1000.0, 1e-3)
    pps = (in_pkts + out_pkts) / duration_s
    asym = abs(in_pkts - out_pkts) / max(in_pkts + out_pkts, 1)
    matched = pps >= 100 and asym >= 0.6
    return SubagentResult(
        name="volumetric_check",
        verdict="match" if matched else "no_match",
        confidence=min(1.0, pps / 1000.0),
        evidence={"pps": round(pps, 2), "asymmetry": round(asym, 2)},
    )


def tcp_flag_check(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """SYN-only or RST-storm patterns."""
    flags = int(_net(alert).get("tcp_flags", 0) or 0)
    syn = bool(flags & 0x02)
    ack = bool(flags & 0x10)
    rst = bool(flags & 0x04)
    matched = (syn and not ack) or rst
    return SubagentResult(
        name="tcp_flag_check",
        verdict="match" if matched else "no_match",
        confidence=0.7 if matched else 0.2,
        evidence={"syn_only": syn and not ack, "rst": rst, "raw": flags},
    )


def historical_check(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """RAG-driven recurrence indicator (from pre-fetch)."""
    snippets = int(intel.get("rag_snippets_count", 0) or 0)
    matched = snippets >= 2
    return SubagentResult(
        name="historical_check",
        verdict="match" if matched else "no_match",
        confidence=min(1.0, snippets / 5.0),
        evidence={"rag_snippets_count": snippets},
    )


def port_signature_check(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """Suspicious destination ports common in reverse shells / C2."""
    dst_port = int(_net(alert).get("dst_port", 0) or 0)
    matched = dst_port in _SUSPICIOUS_PORTS
    return SubagentResult(
        name="port_signature_check",
        verdict="match" if matched else "no_match",
        confidence=0.85 if matched else 0.1,
        evidence={"dst_port": dst_port, "list_size": len(_SUSPICIOUS_PORTS)},
    )


def payload_pattern_check(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """Crude payload-size heuristic for encoded RCE / shellcode."""
    net = _net(alert)
    in_b = int(net.get("in_bytes", 0) or 0)
    out_b = int(net.get("out_bytes", 0) or 0)
    total = in_b + out_b
    matched = 50 <= total <= 4096 and (out_b > in_b * 4 or in_b > out_b * 4)
    return SubagentResult(
        name="payload_pattern_check",
        verdict="match" if matched else "no_match",
        confidence=0.6 if matched else 0.25,
        evidence={"in_bytes": in_b, "out_bytes": out_b, "total": total},
    )


def c2_persistence_check(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """Long-lived asymmetric flow → candidate C2 backdoor."""
    net = _net(alert)
    duration_ms = float(net.get("duration_ms", 0) or 0)
    in_b = int(net.get("in_bytes", 0) or 0)
    out_b = int(net.get("out_bytes", 0) or 0)
    matched = duration_ms >= 10_000 and abs(in_b - out_b) / max(in_b + out_b, 1) >= 0.7
    return SubagentResult(
        name="c2_persistence_check",
        verdict="match" if matched else "no_match",
        confidence=min(1.0, duration_ms / 60_000.0),
        evidence={"duration_ms": duration_ms, "in_bytes": in_b, "out_bytes": out_b},
    )


def port_scan_detector(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """Window-level fan-out across destinations."""
    win = _window(alert)
    unique_dst = int(win.get("unique_dst_ips", 0) or 0)
    matched = unique_dst >= 10
    return SubagentResult(
        name="port_scan_detector",
        verdict="match" if matched else "no_match",
        confidence=min(1.0, unique_dst / 50.0),
        evidence={"unique_dst_ips": unique_dst},
    )


def web_probe_detector(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """Likely HTTP probing if port is web + low payload + short flow."""
    net = _net(alert)
    dst_port = int(net.get("dst_port", 0) or 0)
    duration_ms = float(net.get("duration_ms", 0) or 0)
    in_b = int(net.get("in_bytes", 0) or 0)
    matched = dst_port in {80, 443, 8080, 8443} and duration_ms <= 2_000 and in_b <= 1024
    return SubagentResult(
        name="web_probe_detector",
        verdict="match" if matched else "no_match",
        confidence=0.55 if matched else 0.2,
        evidence={"dst_port": dst_port, "duration_ms": duration_ms, "in_bytes": in_b},
    )


def scanner_allowlist_check(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """If src_ip belongs to a benign reputation class, downweight verdict."""
    rep = (intel.get("ip_reputation") or {}).get("category")
    matched = rep in {"internal", "neutral"}
    return SubagentResult(
        name="scanner_allowlist_check",
        verdict="match" if matched else "no_match",
        confidence=0.5 if matched else 0.2,
        evidence={"ip_reputation_category": rep},
    )


def lateral_movement_check(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """Many internal destinations from same source → worm propagation."""
    win = _window(alert)
    unique_dst = int(win.get("unique_dst_ips", 0) or 0)
    src_ip = _net(alert).get("src_ip", "")
    internal_src = src_ip and src_ip.startswith(("10.", "192.168.", "172."))
    matched = unique_dst >= 5 and bool(internal_src)
    return SubagentResult(
        name="lateral_movement_check",
        verdict="match" if matched else "no_match",
        confidence=min(1.0, unique_dst / 20.0),
        evidence={"unique_dst_ips": unique_dst, "internal_src": bool(internal_src)},
    )


def payload_signature_check(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """Payload size matching common shellcode size buckets."""
    in_b = int(_net(alert).get("in_bytes", 0) or 0)
    matched = in_b in range(40, 600)
    return SubagentResult(
        name="payload_signature_check",
        verdict="match" if matched else "no_match",
        confidence=0.5 if matched else 0.2,
        evidence={"in_bytes": in_b},
    )


def outbreak_correlation(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """Window-level attack ratio implies an active outbreak."""
    win = _window(alert)
    ratio = float(win.get("attack_ratio", 0.0) or 0.0)
    matched = ratio >= 0.3
    return SubagentResult(
        name="outbreak_correlation",
        verdict="match" if matched else "no_match",
        confidence=min(1.0, ratio),
        evidence={"attack_ratio": ratio},
    )


def entropy_check(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """Heuristic entropy proxy from byte/packet ratios."""
    net = _net(alert)
    bytes_total = int(net.get("in_bytes", 0)) + int(net.get("out_bytes", 0))
    pkts_total = int(net.get("in_pkts", 0)) + int(net.get("out_pkts", 0))
    avg_size = bytes_total / max(pkts_total, 1)
    matched = avg_size >= 500
    return SubagentResult(
        name="entropy_check",
        verdict="match" if matched else "no_match",
        confidence=0.4,
        evidence={"avg_pkt_size": round(avg_size, 1)},
    )


def tls_fingerprint_check(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """Suspicious if TLS service but no L7 protocol identified."""
    net = _net(alert)
    dst_port = int(net.get("dst_port", 0) or 0)
    l7_proto = net.get("l7_proto")
    matched = dst_port in {443, 8443} and (l7_proto in (None, 0, 0.0))
    return SubagentResult(
        name="tls_fingerprint_check",
        verdict="match" if matched else "no_match",
        confidence=0.5 if matched else 0.2,
        evidence={"dst_port": dst_port, "l7_proto": l7_proto},
    )


def correlation_check(alert: Dict[str, Any], intel: Dict[str, Any]) -> SubagentResult:
    """Generic RAG correlation gate."""
    snippets = int(intel.get("rag_snippets_count", 0) or 0)
    matched = snippets >= 1
    return SubagentResult(
        name="correlation_check",
        verdict="match" if matched else "no_match",
        confidence=min(1.0, snippets / 3.0),
        evidence={"rag_snippets_count": snippets},
    )


# Public catalogue: skill name → ordered dict of subagents.
SKILL_SUBAGENTS: Dict[str, Dict[str, SubagentFn]] = {
    "dos_fuzzers": {
        "volumetric_check": volumetric_check,
        "tcp_flag_check": tcp_flag_check,
        "historical_check": historical_check,
    },
    "exploits_backdoor": {
        "port_signature_check": port_signature_check,
        "payload_pattern_check": payload_pattern_check,
        "c2_persistence_check": c2_persistence_check,
    },
    "recon_analysis": {
        "port_scan_detector": port_scan_detector,
        "web_probe_detector": web_probe_detector,
        "scanner_allowlist_check": scanner_allowlist_check,
    },
    "shellcode_worms": {
        "lateral_movement_check": lateral_movement_check,
        "payload_signature_check": payload_signature_check,
        "outbreak_correlation": outbreak_correlation,
    },
    "generic": {
        "entropy_check": entropy_check,
        "tls_fingerprint_check": tls_fingerprint_check,
        "correlation_check": correlation_check,
    },
}
