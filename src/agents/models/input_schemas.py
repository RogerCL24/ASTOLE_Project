"""ASTOLE — Input schemas: data contracts for the GNN Data Engine (Engineer 1)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class AttackCategory(str, Enum):
    """The 9 attack categories from dataset NF-UNSW-NB15-v3 + Benign."""

    BENIGN = "Benign"
    DOS = "DoS"
    FUZZERS = "Fuzzers"
    EXPLOITS = "Exploits"
    BACKDOOR = "Backdoor"
    RECONNAISSANCE = "Reconnaissance"
    ANALYSIS = "Analysis"
    GENERIC = "Generic"
    SHELLCODE = "Shellcode"
    WORMS = "Worms"


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class GNNMetadata(BaseModel):
    """Classification metadata from the GNN model."""

    label_binary: str = Field(..., description="Binary classification: Attack or Benign")
    label_multiclass: AttackCategory = Field(..., description="Attack type (9 classes)")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="GNN model confidence")
    model_version: str = Field(default="gnn-v3.1", description="Model version that generated the prediction")


class NetworkData(BaseModel):
    """NetFlow network data for the flow that triggered the alert."""

    src_ip: str = Field(..., description="Source IP")
    dst_ip: str = Field(..., description="Destination IP")
    src_port: int = Field(..., ge=0, le=65535)
    dst_port: int = Field(..., ge=0, le=65535)
    protocol: int = Field(..., description="IP protocol number (6=TCP, 17=UDP, 1=ICMP)")
    duration_ms: float = Field(default=0.0, ge=0.0, description="Flow duration in ms")
    in_bytes: int = Field(default=0, ge=0, description="Incoming bytes")
    out_bytes: int = Field(default=0, ge=0, description="Outgoing bytes")
    in_pkts: int = Field(default=0, ge=0, description="Incoming packets")
    out_pkts: int = Field(default=0, ge=0, description="Outgoing packets")
    tcp_flags: int = Field(default=0, ge=0, description="Accumulated TCP flags bitmask")

    @property
    def protocol_name(self) -> str:
        return {6: "TCP", 17: "UDP", 1: "ICMP"}.get(self.protocol, f"OTHER({self.protocol})")

    @property
    def tcp_flags_str(self) -> str:
        """Convert numeric bitmask to readable string (e.g. 18 → 'SA')."""
        flag_map = [
            (0x01, "F"),  # FIN
            (0x02, "S"),  # SYN
            (0x04, "R"),  # RST
            (0x08, "P"),  # PSH
            (0x10, "A"),  # ACK
            (0x20, "U"),  # URG
        ]
        return "".join(letter for mask, letter in flag_map if self.tcp_flags & mask)


class TopFeatures(BaseModel):
    """Top features influencing the GNN decision."""

    f_duration: Optional[float] = None
    f_in_pkts: Optional[int] = None
    f_out_pkts: Optional[int] = None
    f_tcp_flags: Optional[str] = None
    f_retransmitted_in_bytes: Optional[int] = None
    f_flow_duration_ms: Optional[float] = None
    extra: Dict[str, Any] = Field(default_factory=dict)


class WindowStats(BaseModel):
    """Statistics for the 60-second window."""

    total_flows: int = Field(default=1, ge=1)
    attack_flows: int = Field(default=1, ge=0)
    attack_ratio: float = Field(default=0.0, ge=0.0, le=1.0)
    unique_src_ips: int = Field(default=1, ge=1)
    unique_dst_ips: int = Field(default=1, ge=1)


# ---------------------------------------------------------------------------
# Main input model
# ---------------------------------------------------------------------------

class InputAlert(BaseModel):
    """Alert JSON sent by Engineer 1 to the multi-agent pipeline."""

    alert_id: str = Field(..., description="Unique alert ID (e.g. AST-2026-001)")
    timestamp: str = Field(..., description="ISO 8601 detection timestamp")
    window_id: str = Field(default="", description="60s window ID for correlation")
    gnn_metadata: GNNMetadata
    network_data: NetworkData
    top_features: TopFeatures = Field(default_factory=TopFeatures)
    window_stats: WindowStats = Field(default_factory=WindowStats)

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, v: str) -> str:
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError as e:
            raise ValueError(f"timestamp must be valid ISO 8601: {e}")
        return v
