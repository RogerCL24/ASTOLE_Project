"""ASTOLE — Output schemas: data contracts for the Dashboard (Engineer 4)."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SeverityLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class ThreatLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


# ---------------------------------------------------------------------------
# Skill output
# ---------------------------------------------------------------------------

class IOC(BaseModel):
    """Indicator of Compromise."""

    type: str = Field(..., description="Type: ip, port, domain, hash, etc.")
    value: Any = Field(..., description="IOC value")
    role: str = Field(..., description="Role: attacker, victim, target_service, c2, etc.")


class SkillAssessment(BaseModel):
    """Structured output produced by each skill after analysis."""

    threat_type: str
    threat_subtype: str = ""
    threat_level: ThreatLevel
    confidence_adjusted: float = Field(ge=0.0, le=1.0)
    is_real_threat: bool
    false_positive_probability: float = Field(ge=0.0, le=1.0)
    key_indicators: List[str] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    iocs: List[IOC] = Field(default_factory=list)
    technical_detail: str = ""


# ---------------------------------------------------------------------------
# Triage output (final response to Dashboard)
# ---------------------------------------------------------------------------

class TokenUsage(BaseModel):
    """Detailed token tracking per component."""

    router: int = 0
    skill: int = 0
    summarizer: int = 0
    total: int = 0


class Narrative(BaseModel):
    """Hierarchical narrative for the dashboard."""

    executive: str = Field(..., description="Executive summary (1-2 sentences)")
    tactical: str = Field(..., description="Technical/tactical detail with RAG context")
    impact: str = Field(..., description="Business/operational impact statement")
    recommended_actions: List[str] = Field(default_factory=list)
    iocs: List[IOC] = Field(default_factory=list)


class InvestigationHints(BaseModel):
    """Suggestions for the interactive investigation (Chat RAG, Layer 2)."""

    suggested_queries: List[str] = Field(default_factory=list)
    related_alert_ids: List[str] = Field(default_factory=list)


class ContextUsed(BaseModel):
    """Summary of RAG context used."""

    rag_snippets_count: int = 0
    historical_alerts_same_ip: int = 0
    related_window_alerts: int = 0


class TriageMetadata(BaseModel):
    """Processing metadata for the KPI & Token Monitor."""

    processing_time_ms: int = 0
    tokens_used: TokenUsage = Field(default_factory=TokenUsage)
    cost_usd: float = 0.0
    models_used: List[str] = Field(default_factory=list)
    cache_hit: bool = False


class TriageOutput(BaseModel):
    """Final pipeline response towards the Dashboard (Engineer 4)."""

    triage_id: str
    alert_id: str
    timestamp_processed: str
    severity: SeverityLevel
    is_escalated: bool = False
    assessment: SkillAssessment
    narrative: Narrative
    context_used: ContextUsed = Field(default_factory=ContextUsed)
    skills_activated: List[str] = Field(default_factory=list)
    investigation_hints: InvestigationHints = Field(default_factory=InvestigationHints)
    metadata: TriageMetadata = Field(default_factory=TriageMetadata)
