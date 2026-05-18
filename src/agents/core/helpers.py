"""Cross-cutting helper functions for agent nodes.

This module centralizes lightweight, deterministic transformations used across
router, skills, and summarizer nodes so contract handling remains consistent.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict


def get_multiclass_label(gnn_metadata: Dict[str, Any]) -> str:
    """Return the multiclass label regardless of key naming variant."""
    value = (
        gnn_metadata.get("label_multiclase")
        or gnn_metadata.get("label_multiclass")
        or "Unknown"
    )
    if isinstance(value, Enum):
        return str(value.value)
    return str(value)


def get_binary_attack(gnn_metadata: Dict[str, Any]) -> int:
    """Return normalized binary attack value (0/1) from mixed inputs."""
    value = gnn_metadata.get("binary_attack", gnn_metadata.get("label_binary", 0))
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return 1 if value else 0
    if isinstance(value, str):
        cleaned = value.strip().lower()
        if cleaned in {"attack", "1", "true"}:
            return 1
        if cleaned in {"benign", "0", "false"}:
            return 0
    return 0
