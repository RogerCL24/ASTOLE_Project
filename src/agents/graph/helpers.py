"""Helper functions for graph-level orchestration logic."""

from __future__ import annotations

from typing import Any, Dict, Iterable


def route_to_skill(state: Dict[str, Any], valid_nodes: Iterable[str]) -> str:
    """Return a safe skill destination from router output.

    The router should always emit one of the registered skill node names.
    This helper keeps the graph resilient: any invalid/unknown value is
    redirected to `generic` instead of breaking the execution.
    """
    valid = set(valid_nodes)
    skill = state.get("skill_activated", "generic")
    return skill if skill in valid else "generic"
