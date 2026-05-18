"""ASTOLE — Structured handoffs between agents.

Every stage of the triage pipeline emits a handoff with five mandatory blocks
that travel forward in :class:`AgentState`. This guarantees:

- traceability: each stage records who asked what to whom;
- antirepetition: downstream agents reuse the accumulated context instead of
  re-exploring;
- scope-lock: a stage cannot expand the scope set by the previous one;
- existence-validation: every handoff reminds the receiver to check whether
  the work is already done (cache, prior assessment, etc.);
- plan_status distinction: every stage tags its output as either ``OK``,
  ``PLAN_VACIO`` (no work needed, justified) or ``ERROR`` (work needed but
  blocked).
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional


class PlanStatus(str, Enum):
    """Outcome status of a pipeline stage.

    ``OK`` — stage produced its expected artifact;
    ``PLAN_VACIO`` — stage had no work to do; ``reason`` MUST be set;
    ``ERROR`` — stage was blocked; ``reason`` MUST be set; pipeline continues
    with degradation but flags the failure.
    """

    OK = "OK"
    PLAN_VACIO = "PLAN_VACIO"
    ERROR = "ERROR"


@dataclass
class Handoff:
    """Structured 5-block handoff emitted by an agent.

    Attributes:
        stage:               Which pipeline stage emitted the handoff.
        from_agent:          Producer agent name (e.g. ``"router"``).
        to_agent:            Consumer agent name (e.g. ``"dos_fuzzers"``).
        task:                Precise instruction for the receiver.
        scope:               Fields / records the receiver may read or write.
        accumulated_context: Concrete facts gathered by previous stages.
        constraints:         What the receiver must NOT do; MUST include
                             existence-validation reminder.
        attention_points:    Risks, dependencies, pending decisions.
        plan_status:         OK / PLAN_VACIO / ERROR.
        reason:              Justification when status is not OK.
    """

    stage: str
    from_agent: str
    to_agent: str
    task: str
    scope: List[str] = field(default_factory=list)
    accumulated_context: Dict[str, Any] = field(default_factory=dict)
    constraints: List[str] = field(default_factory=list)
    attention_points: List[str] = field(default_factory=list)
    plan_status: PlanStatus = PlanStatus.OK
    reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the handoff for state-persistence and observability."""
        data = asdict(self)
        data["plan_status"] = self.plan_status.value
        return data


def make_handoff(
    stage: str,
    from_agent: str,
    to_agent: str,
    task: str,
    *,
    scope: Optional[List[str]] = None,
    accumulated_context: Optional[Dict[str, Any]] = None,
    constraints: Optional[List[str]] = None,
    attention_points: Optional[List[str]] = None,
    plan_status: PlanStatus = PlanStatus.OK,
    reason: Optional[str] = None,
) -> Handoff:
    """Build a handoff with mandatory existence-validation reminder.

    ASTOLE convention: every handoff must remind the receiver to check
    whether the desired artifact already exists (cache hit, prior
    assessment, RAG context already loaded, etc.). This constraint is added
    automatically if the caller did not provide it explicitly.
    """
    constraints = list(constraints or [])
    if not any("existence" in c.lower() for c in constraints):
        constraints.insert(
            0,
            "Validate cache / prior-assessment existence before re-computing.",
        )
    return Handoff(
        stage=stage,
        from_agent=from_agent,
        to_agent=to_agent,
        task=task,
        scope=list(scope or []),
        accumulated_context=dict(accumulated_context or {}),
        constraints=constraints,
        attention_points=list(attention_points or []),
        plan_status=plan_status,
        reason=reason,
    )


def append_handoff(state: Dict[str, Any], handoff: Handoff) -> None:
    """Append a handoff to the running ``AgentState``.

    Mutates the passed-in state dictionary so it stays compatible with
    LangGraph's ``TypedDict``-based state contract.
    """
    handoffs = list(state.get("handoffs", []))
    handoffs.append(handoff.to_dict())
    state["handoffs"] = handoffs

    plan_statuses = dict(state.get("plan_statuses", {}))
    plan_statuses[handoff.stage] = handoff.plan_status.value
    state["plan_statuses"] = plan_statuses

    if handoff.plan_status == PlanStatus.ERROR and handoff.reason:
        errs = list(state.get("errors", []))
        errs.append(f"[{handoff.stage}] [ERROR] {handoff.reason}")
        state["errors"] = errs
