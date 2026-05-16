"""ASTOLE — LiteLLM callback for token and cost tracking.

Registered as a global LiteLLM callback. Accumulates tokens/cost
per each call and exposes them for the AgentState to collect.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any, Dict

from litellm import completion_cost
from litellm.integrations.custom_logger import CustomLogger


@dataclass
class CallMetrics:
    """Metrics for a single LLM call."""
    model: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0


class CostTracker(CustomLogger):
    """
    LiteLLM callback that accumulates token and cost metrics.

    Usage:
        tracker = CostTracker()
        litellm.callbacks = [tracker]

        # After one or more calls:
        metrics = tracker.get_and_reset()
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._calls: list[CallMetrics] = []

    # -- LiteLLM callback interface ------------------------------------------

    def log_success_event(self, kwargs: Dict[str, Any], response_obj: Any, start_time: Any, end_time: Any) -> None:
        usage = getattr(response_obj, "usage", None)
        if usage is None:
            return

        model = kwargs.get("model", "unknown")
        prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
        completion_tokens = getattr(usage, "completion_tokens", 0) or 0
        total = prompt_tokens + completion_tokens

        try:
            cost = completion_cost(
                model=model,
                prompt=str(prompt_tokens),
                completion=str(completion_tokens),
            )
        except Exception:
            cost = 0.0

        call = CallMetrics(
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total,
            cost_usd=cost,
        )

        with self._lock:
            self._calls.append(call)

    # -- Public API ----------------------------------------------------------

    def get_and_reset(self) -> list[CallMetrics]:
        """Return accumulated metrics and reset the counter."""
        with self._lock:
            calls = list(self._calls)
            self._calls.clear()
        return calls

    def get_totals(self) -> Dict[str, Any]:
        """Return accumulated totals without resetting.

        ``num_calls`` MUST be captured under the same lock as the rest of
        the metrics; otherwise concurrent ``log_success_event`` callbacks
        can mutate ``self._calls`` between the two reads and produce a
        ``num_calls`` that is inconsistent with ``total_tokens`` /
        ``total_cost_usd``.
        """
        with self._lock:
            total_tokens = sum(c.total_tokens for c in self._calls)
            total_cost = sum(c.cost_usd for c in self._calls)
            models = list({c.model for c in self._calls})
            num_calls = len(self._calls)
        return {
            "total_tokens": total_tokens,
            "total_cost_usd": total_cost,
            "models_used": models,
            "num_calls": num_calls,
        }


# Global instance — imported wherever needed
cost_tracker = CostTracker()
