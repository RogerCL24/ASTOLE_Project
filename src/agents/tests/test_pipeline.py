"""ASTOLE — Triage pipeline tests.

Includes:
- Schema validation tests (Pydantic)
- Router tests (rule-based and fallback)
- Full pipeline integration tests (with deterministic LiteLLM mocking)
- Fixtures with sample alerts for each attack type from NF-UNSW-NB15-v3
"""

from __future__ import annotations

import json
import os
import random
from types import SimpleNamespace
from typing import Any, Dict
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Force mock mode for tests
os.environ["RAG_USE_MOCK"] = "true"
os.environ["CACHE_ENABLED"] = "false"

from src.agents.main import app
from src.agents.models.input_schemas import (
    AttackCategory,
    InputAlert,
    NetworkData,
)
from src.agents.agents.router import SKILL_MAP, router_node


# ---------------------------------------------------------------------------
# Fixtures: sample alerts for each attack type
# ---------------------------------------------------------------------------

def _make_alert(
    alert_id: str,
    label: str,
    confidence: float = 0.92,
    src_ip: str = "192.168.1.50",
    dst_ip: str = "10.0.0.5",
    src_port: int = 443,
    dst_port: int = 80,
    protocol: int = 6,
    duration_ms: float = 4.5,
    in_bytes: int = 512,
    out_bytes: int = 1024,
) -> Dict[str, Any]:
    """Helper to create test alerts."""
    return {
        "alert_id": alert_id,
        "timestamp": "2026-03-02T22:15:00Z",
        "window_id": "WIN-2026-0302-2215",
        "gnn_metadata": {
            "binary_attack": 0 if label == "Benign" else 1,
            "label_multiclase": label,
            "confidence_score": confidence,
            "model_version": "gnn-v3.1-test",
        },
        "network_data": {
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "src_port": src_port,
            "dst_port": dst_port,
            "protocol": protocol,
            "duration_ms": duration_ms,
            "in_bytes": in_bytes,
            "out_bytes": out_bytes,
            "in_pkts": 12,
            "out_pkts": 8,
            "tcp_flags": 18,
        },
        "top_features": {
            "f_duration": duration_ms / 1000,
            "f_in_pkts": 12,
            "f_out_pkts": 8,
            "f_tcp_flags": "SA",
        },
        "window_stats": {
            "total_flows": 342,
            "attack_flows": 18,
            "attack_ratio": 0.053,
            "unique_src_ips": 5,
            "unique_dst_ips": 12,
        },
    }


# Sample alerts for each attack category
SAMPLE_ALERTS: Dict[str, Dict[str, Any]] = {
    "Benign": _make_alert("AST-TEST-BEN", "Benign", 0.98, dst_port=53, in_bytes=32),
    "DoS": _make_alert("AST-TEST-DOS", "DoS", 0.94, duration_ms=2.1, in_bytes=64),
    "Fuzzers": _make_alert("AST-TEST-FUZ", "Fuzzers", 0.88, dst_port=8080, in_bytes=4096),
    "Exploits": _make_alert("AST-TEST-EXP", "Exploits", 0.91, dst_port=445, out_bytes=2048),
    "Backdoor": _make_alert("AST-TEST-BDR", "Backdoor", 0.87, duration_ms=30000, out_bytes=8192),
    "Reconnaissance": _make_alert("AST-TEST-REC", "Reconnaissance", 0.85, duration_ms=1.2, in_bytes=0),
    "Analysis": _make_alert("AST-TEST-ANA", "Analysis", 0.83, dst_port=80, in_bytes=256),
    "Generic": _make_alert("AST-TEST-GEN", "Generic", 0.76, dst_port=443, in_bytes=1024),
    "Shellcode": _make_alert("AST-TEST-SHC", "Shellcode", 0.90, dst_port=135, in_bytes=90),
    "Worms": _make_alert("AST-TEST-WRM", "Worms", 0.95, dst_port=445, duration_ms=0.8),
}


# ---------------------------------------------------------------------------
# Schema Tests
# ---------------------------------------------------------------------------

class TestSchemas:
    """Tests for Pydantic models validation."""

    def test_input_alert_valid(self):
        alert = InputAlert(**SAMPLE_ALERTS["DoS"])
        assert alert.alert_id == "AST-TEST-DOS"
        assert alert.gnn_metadata.label_multiclase == AttackCategory.DOS

    def test_input_alert_invalid_timestamp(self):
        data = SAMPLE_ALERTS["DoS"].copy()
        data["timestamp"] = "not-a-timestamp"
        with pytest.raises(Exception):
            InputAlert(**data)

    def test_input_alert_invalid_confidence(self):
        data = SAMPLE_ALERTS["DoS"].copy()
        data["gnn_metadata"] = {**data["gnn_metadata"], "confidence_score": 1.5}
        with pytest.raises(Exception):
            InputAlert(**data)

    def test_network_data_protocol_name(self):
        net = NetworkData(**SAMPLE_ALERTS["DoS"]["network_data"])
        assert net.protocol_name == "TCP"

    def test_network_data_tcp_flags_str(self):
        net = NetworkData(**SAMPLE_ALERTS["DoS"]["network_data"])
        # tcp_flags=18 (0x12) = SYN + ACK → "SA"
        assert net.tcp_flags_str == "SA"

    def test_all_attack_categories_valid(self):
        for label in SAMPLE_ALERTS:
            alert = InputAlert(**SAMPLE_ALERTS[label])
            assert alert.gnn_metadata.label_multiclase.value == label


# ---------------------------------------------------------------------------
# Router Tests
# ---------------------------------------------------------------------------

class TestRouter:
    """Tests for the router node."""

    @pytest.mark.asyncio
    async def test_rule_based_routing_all_labels(self):
        """Verify all dataset labels route to the correct skill."""
        for label, expected_skill in SKILL_MAP.items():
            state = {
                "input": _make_alert(f"TEST-{label}", label),
                "skill_activated": "",
                "confidence_tier": "standard",
                "tokens_used": {},
                "models_used": [],
                "errors": [],
            }
            result = await router_node(state)
            assert result["skill_activated"] == expected_skill, (
                f"Label '{label}' should route to '{expected_skill}', "
                f"but routed to '{result['skill_activated']}'"
            )

    @pytest.mark.asyncio
    async def test_router_200_synthetic_alerts(self):
        """Stress router logic with 200 synthetic alerts."""
        labels = list(SKILL_MAP.keys())
        for i in range(200):
            label = random.choice(labels)
            confidence = random.uniform(0.55, 0.99)
            state = {
                "input": _make_alert(f"SYNTH-{i:03d}", label, confidence=confidence),
                "skill_activated": "",
                "confidence_tier": "",
                "tokens_used": {},
                "models_used": [],
                "errors": [],
            }
            result = await router_node(state)
            assert result["skill_activated"] == SKILL_MAP[label]
            assert result["confidence_tier"] in {"fast", "standard", "deep"}

    @pytest.mark.asyncio
    async def test_confidence_tier_fast(self):
        state = {
            "input": _make_alert("TEST", "DoS", confidence=0.95),
            "skill_activated": "",
            "confidence_tier": "",
            "tokens_used": {},
            "models_used": [],
            "errors": [],
        }
        result = await router_node(state)
        assert result["confidence_tier"] == "fast"

    @pytest.mark.asyncio
    async def test_confidence_tier_standard(self):
        state = {
            "input": _make_alert("TEST", "DoS", confidence=0.80),
            "skill_activated": "",
            "confidence_tier": "",
            "tokens_used": {},
            "models_used": [],
            "errors": [],
        }
        result = await router_node(state)
        assert result["confidence_tier"] == "standard"

    @pytest.mark.asyncio
    async def test_confidence_tier_deep(self):
        state = {
            "input": _make_alert("TEST", "DoS", confidence=0.60),
            "skill_activated": "",
            "confidence_tier": "",
            "tokens_used": {},
            "models_used": [],
            "errors": [],
        }
        result = await router_node(state)
        assert result["confidence_tier"] == "deep"

    @pytest.mark.asyncio
    async def test_benign_routes_to_benign_guard(self):
        """Benign flows should bypass expensive skill inference."""
        state = {
            "input": _make_alert("TEST-BENIGN", "Benign"),
            "skill_activated": "",
            "confidence_tier": "",
            "tokens_used": {},
            "models_used": [],
            "errors": [],
        }
        result = await router_node(state)
        assert result["skill_activated"] == "benign_guard"


# ---------------------------------------------------------------------------
# FastAPI API Tests
# ---------------------------------------------------------------------------

class TestAPI:
    """REST API integration tests."""

    @pytest_asyncio.fixture
    async def client(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c

    @pytest.mark.asyncio
    async def test_health(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"

    @pytest.mark.asyncio
    async def test_metrics(self, client):
        resp = await client.get("/metrics")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_tokens" in data

    @pytest.mark.asyncio
    async def test_triage_invalid_alert(self, client):
        """Invalid JSON should return 422."""
        resp = await client.post("/triage", json={"bad": "data"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_triage_valid_alert_structure(self, client):
        """End-to-end /triage with a deterministic LiteLLM mock.

        Mocks ``litellm.acompletion`` for both the skill and summarizer
        nodes so the test always returns 200 and validates the contract
        without external dependencies.
        """
        skill_payload = json.dumps({
            "threat_type": "DoS",
            "threat_subtype": "Volumetric",
            "threat_level": "high",
            "confidence_adjusted": 0.92,
            "is_real_threat": True,
            "false_positive_probability": 0.05,
            "key_indicators": ["High pps from single source"],
            "recommended_actions": ["Rate-limit", "Notify SOC"],
            "iocs": [],
            "technical_detail": "Mocked DoS assessment.",
        })
        summarizer_payload = json.dumps({
            "executive": "DoS detected.",
            "tactical": "High pps unidirectional flow.",
            "impact": "Service availability at risk.",
            "recommended_actions": ["Rate-limit"],
            "suggested_queries": ["Has this src_ip recurred?"],
            "severity": "high",
            "should_escalate": False,
        })

        async def fake_acompletion(*args, **kwargs):
            messages = kwargs.get("messages") or (args[1] if len(args) > 1 else [])
            sys_msg = next((m for m in messages if m.get("role") == "system"), {}) or {}
            content = sys_msg.get("content", "")
            payload = summarizer_payload if "CISO" in content or "executive" in content.lower() else skill_payload
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content=payload))],
                usage=SimpleNamespace(total_tokens=50, prompt_tokens=30, completion_tokens=20),
            )

        with patch("src.agents.agents.skills.base_skill.acompletion", side_effect=fake_acompletion), \
             patch("src.agents.agents.summarizer.acompletion", side_effect=fake_acompletion):
            resp = await client.post("/triage", json=SAMPLE_ALERTS["DoS"])

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "triage_id" in data
        assert data["alert_id"] == SAMPLE_ALERTS["DoS"]["alert_id"]
        assert data["severity"] in {"critical", "high", "medium", "low", "info"}
        for key in ("executive", "tactical", "impact"):
            assert data["narrative"][key], f"narrative.{key} must not be empty"
        assert "metadata" in data
        assert "tokens_used" in data["metadata"]

    @pytest.mark.asyncio
    async def test_triage_batch_too_many(self, client):
        """A batch of >50 alerts should return 400."""
        alerts = [SAMPLE_ALERTS["DoS"]] * 51
        resp = await client.post("/triage/batch", json=alerts)
        assert resp.status_code == 400
