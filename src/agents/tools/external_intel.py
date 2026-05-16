"""ASTOLE — External intelligence tools (MCP-style).

This module exposes a small, deterministic catalogue of "external"
intelligence look-ups that skills consume during analysis:

- :func:`mitre_attack_lookup` — map a multiclass label to MITRE ATT&CK
  techniques.
- :func:`ip_reputation_lookup` — return a synthetic reputation score for
  an IP (real backends like AbuseIPDB are pluggable via ``ASTOLE_INTEL_*``
  environment variables).
- :func:`cve_lookup` — return candidate CVE IDs for a `(service, port)`
  pair.

All look-ups are wrapped behind a generic :class:`MCPClient` interface so
they can be swapped at runtime for a real MCP (Model Context Protocol)
server when one is available.

The default implementation is **fully offline** (curated mappings + a
hash-based deterministic score) so the pipeline can be exercised without
any external network call. This keeps tests deterministic and CI
reproducible while giving downstream skills realistic context to feed the
LLM.
"""

from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# MCP-style client
# ---------------------------------------------------------------------------


@dataclass
class MCPClient:
    """Minimal MCP-style client over HTTP.

    The Model Context Protocol is, at the wire level, a JSON-RPC-ish
    transport for tool calls. We wrap a thin HTTP client so a future
    real MCP server can replace the offline catalogue without touching
    the skills.

    Attributes:
        base_url:    Base URL of the MCP/HTTP intelligence service.
        timeout_s:   Per-call timeout in seconds.
        api_key:     Optional API key (sent as ``Authorization: Bearer``).
        enabled:     Whether to attempt remote calls; if False, all
                     ``call_tool`` invocations return ``None`` and the
                     caller falls back to the offline catalogue.
    """

    base_url: str = ""
    timeout_s: float = 4.0
    api_key: Optional[str] = None
    enabled: bool = False

    @classmethod
    def from_env(cls) -> "MCPClient":
        """Build a client from ``ASTOLE_INTEL_*`` environment variables."""
        base_url = os.getenv("ASTOLE_INTEL_URL", "").strip()
        api_key = os.getenv("ASTOLE_INTEL_API_KEY") or None
        timeout_s = float(os.getenv("ASTOLE_INTEL_TIMEOUT", "4.0"))
        return cls(
            base_url=base_url,
            api_key=api_key,
            timeout_s=timeout_s,
            enabled=bool(base_url),
        )

    async def call_tool(self, tool: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Invoke an MCP tool and return the JSON response or None on error.

        Errors are intentionally non-fatal: the offline catalogue is
        always available as a fallback, so an MCP outage cannot block
        the triage pipeline.
        """
        if not self.enabled:
            return None
        url = f"{self.base_url.rstrip('/')}/tools/{tool}"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout_s) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("MCP tool '%s' failed: %s", tool, exc)
            return None


# Single process-wide client (loaded from env once)
_mcp_client = MCPClient.from_env()


# ---------------------------------------------------------------------------
# Offline catalogues
# ---------------------------------------------------------------------------


# Curated NF-UNSW-NB15-v3 multiclass → MITRE ATT&CK mapping. The list is
# intentionally short; skills only need a few TTPs to anchor narratives.
_MITRE_TABLE: Dict[str, List[Dict[str, str]]] = {
    "DoS": [
        {"id": "T1498", "name": "Network Denial of Service"},
        {"id": "T1499", "name": "Endpoint Denial of Service"},
    ],
    "Fuzzers": [
        {"id": "T1190", "name": "Exploit Public-Facing Application"},
        {"id": "T1592", "name": "Gather Victim Host Information"},
    ],
    "Exploits": [
        {"id": "T1190", "name": "Exploit Public-Facing Application"},
        {"id": "T1203", "name": "Exploitation for Client Execution"},
    ],
    "Backdoor": [
        {"id": "T1071", "name": "Application Layer Protocol (C2)"},
        {"id": "T1505.003", "name": "Web Shell"},
    ],
    "Reconnaissance": [
        {"id": "T1595", "name": "Active Scanning"},
        {"id": "T1592", "name": "Gather Victim Host Information"},
    ],
    "Analysis": [
        {"id": "T1595.002", "name": "Vulnerability Scanning"},
    ],
    "Shellcode": [
        {"id": "T1055", "name": "Process Injection"},
        {"id": "T1059", "name": "Command and Scripting Interpreter"},
    ],
    "Worms": [
        {"id": "T1210", "name": "Exploitation of Remote Services"},
        {"id": "T1021", "name": "Remote Services"},
    ],
    "Generic": [
        {"id": "T1573", "name": "Encrypted Channel"},
    ],
    "Benign": [],
}


# Coarse port → service hint table for offline CVE candidates.
_PORT_SERVICE_HINTS: Dict[int, str] = {
    21: "ftp",
    22: "ssh",
    23: "telnet",
    25: "smtp",
    53: "dns",
    80: "http",
    110: "pop3",
    135: "rpc",
    139: "smb",
    143: "imap",
    443: "https",
    445: "smb",
    3306: "mysql",
    3389: "rdp",
    5432: "postgresql",
    8080: "http-alt",
    8443: "https-alt",
}

# Hand-curated CVE pointers per service. The IDs are real but the list is
# short on purpose — it provides a hypothesis to feed the LLM, not an
# exhaustive vulnerability catalogue.
_CVE_TABLE: Dict[str, List[str]] = {
    "ssh": ["CVE-2016-0777", "CVE-2018-15473"],
    "smb": ["CVE-2017-0144", "CVE-2020-0796"],
    "http": ["CVE-2021-44228", "CVE-2017-5638"],
    "https": ["CVE-2014-0160"],
    "rpc": ["CVE-2003-0352"],
    "rdp": ["CVE-2019-0708"],
    "ftp": ["CVE-2011-2523"],
    "dns": ["CVE-2020-1350"],
    "telnet": ["CVE-2011-4862"],
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


@dataclass
class IntelResult:
    """Container for the merged offline + remote intelligence payload."""

    source: str = "offline"
    data: Dict[str, Any] = field(default_factory=dict)


async def mitre_attack_lookup(label: str) -> IntelResult:
    """Return MITRE ATT&CK techniques for a multiclass label.

    Tries the configured MCP tool first (if enabled), then falls back to
    the offline curated table.
    """
    remote = await _mcp_client.call_tool("mitre_attack_lookup", {"label": label})
    if remote is not None:
        return IntelResult(source="mcp", data=remote)
    return IntelResult(
        source="offline",
        data={"label": label, "techniques": _MITRE_TABLE.get(label, [])},
    )


async def ip_reputation_lookup(ip: str) -> IntelResult:
    """Return a synthetic IP reputation score in [0, 100].

    The offline implementation derives the score deterministically from a
    SHA-1 of the IP so the value is stable across runs (good for tests).
    Internal/private IPs receive a fixed low score.
    """
    if not ip:
        return IntelResult(data={"ip": "", "score": 0, "category": "unknown"})

    remote = await _mcp_client.call_tool("ip_reputation_lookup", {"ip": ip})
    if remote is not None:
        return IntelResult(source="mcp", data=remote)

    if _is_private_ipv4(ip):
        return IntelResult(data={"ip": ip, "score": 5, "category": "internal"})

    digest = hashlib.sha1(ip.encode("utf-8")).digest()
    score = digest[0] % 101  # deterministic 0..100
    if score >= 80:
        category = "malicious"
    elif score >= 50:
        category = "suspicious"
    else:
        category = "neutral"
    return IntelResult(data={"ip": ip, "score": score, "category": category})


async def cve_lookup(l7_proto: Any = None, dst_port: Optional[int] = None) -> IntelResult:
    """Return candidate CVE IDs for a service/port hypothesis.

    Tries the configured MCP tool first; otherwise consults the offline
    table indexed by service hint derived from ``dst_port``.
    """
    remote = await _mcp_client.call_tool(
        "cve_lookup", {"l7_proto": l7_proto, "dst_port": dst_port}
    )
    if remote is not None:
        return IntelResult(source="mcp", data=remote)

    service = None
    if isinstance(dst_port, int):
        service = _PORT_SERVICE_HINTS.get(dst_port)
    cves = _CVE_TABLE.get(service or "", [])
    return IntelResult(
        source="offline",
        data={"service": service, "dst_port": dst_port, "cves": cves},
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_private_ipv4(ip: str) -> bool:
    """Naive RFC1918 / loopback check (avoid pulling ``ipaddress`` on hot path)."""
    try:
        octets = [int(x) for x in ip.split(".")]
    except ValueError:
        return False
    if len(octets) != 4:
        return False
    a, b = octets[0], octets[1]
    if a == 10:
        return True
    if a == 192 and b == 168:
        return True
    if a == 172 and 16 <= b <= 31:
        return True
    if a == 127:
        return True
    return False
