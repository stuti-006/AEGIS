"""
Data models and schemas for AEGIS / GUARDIANTEXT threat detection system.
"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class AnalysisRequest(BaseModel):
    """Request schema for threat analysis."""
    message: str
    language: str = "en"
    user_id: str = "anonymous"

    class Config:
        json_schema_extra = {
            "example": {
                "message": "I know where you live. You can't escape me.",
                "language": "en",
                "user_id": "user_123"
            }
        }


class RiskFactor(BaseModel):
    """Individual risk factor detected in the message."""
    factor: str
    severity: str        # low | medium | high
    description: str


class EntitiesBlock(BaseModel):
    """Entities extracted during pipeline."""
    locations: List[str] = []
    time: List[str] = []
    people: List[str] = []


class ThreatDNAEntry(BaseModel):
    """Single Threat DNA pattern match."""
    pattern: str = ""
    match: float = 0          # 0-100 match percentage
    explanation: str = ""
    real_world_context: str = ""


class EscalationBlock(BaseModel):
    """Escalation intelligence."""
    detected: bool = False
    type: str = ""


class LegalBlock(BaseModel):
    """Legal context block."""
    sections: List[str] = []
    explanation: str = ""


class EvidenceBlock(BaseModel):
    """Evidence generation data for reports / downloads."""
    message: str = ""
    summary: str = ""
    threat_level: str = ""
    detected_patterns: List[str] = []
    legal_references: List[str] = []
    timestamp: str = ""


class AnalysisResponse(BaseModel):
    """
    Full GUARDIANTEXT response — powers all 5 wow features.
    Legacy fields preserved for backward compatibility.
    """

    # ── Core / legacy ──
    label: str
    confidence: float
    reason: str
    risk_factors: List[RiskFactor] = []
    explanation: str = ""
    risk_score: float = 0
    recommendations: List[str] = []
    analysis_id: str
    timestamp: str

    # ── Feature 1: Real-time Heatmap ──
    threat_level: Optional[str] = None
    color: Optional[str] = None               # GREEN | YELLOW | RED
    toxicity: Optional[float] = 0             # 0–100

    # ── Feature 2 context ──
    tone: Optional[str] = None
    context_type: Optional[str] = None

    # ── Feature 3: Threat DNA ──
    threat_dna: Optional[List[ThreatDNAEntry]] = []
    patterns_detected: Optional[List[str]] = []

    # ── Feature 4: Evidence ──
    evidence: Optional[EvidenceBlock] = None

    # ── Feature 5: Coaching ──
    support_message: Optional[str] = None

    # ── Additional intelligence ──
    entities: Optional[EntitiesBlock] = None
    escalation: Optional[EscalationBlock] = None
    legal: Optional[LegalBlock] = None
    emotional_impact: Optional[List[str]] = []
    urgency: Optional[str] = None
    legal_references: Optional[List[str]] = []
    mcp_status: Optional[bool] = None

    class Config:
        json_schema_extra = {
            "example": {
                "label": "dangerous",
                "confidence": 0.92,
                "reason": "Message contains stalking and coercion indicators.",
                "risk_factors": [{"factor": "stalking", "severity": "high", "description": "Sender knows victim location"}],
                "explanation": "Classic stalking escalation detected.",
                "risk_score": 95.0,
                "recommendations": ["Block sender", "File police complaint"],
                "analysis_id": "ana_abc123",
                "timestamp": "2026-01-15T10:30:00Z",
                "threat_level": "DANGEROUS",
                "color": "RED",
                "toxicity": 88,
                "tone": "aggressive",
                "context_type": "stalking / threat",
                "threat_dna": [{"pattern": "stalking", "match": 92, "explanation": "Persistent surveillance pattern", "real_world_context": "76% of femicide victims were stalked beforehand."}],
                "patterns_detected": ["stalking", "intimidation"],
                "evidence": {"message": "I know where you live.", "summary": "Stalking threat detected", "threat_level": "DANGEROUS", "detected_patterns": ["stalking"], "legal_references": ["IPC 354D"], "timestamp": "2026-01-15T10:30:00Z"},
                "support_message": "You are not alone. Your safety matters.",
                "entities": {"locations": ["home"], "time": ["tonight"], "people": []},
                "escalation": {"detected": True, "type": "surveillance expansion"},
                "legal": {"sections": ["IPC 354D"], "explanation": "Stalking is punishable under IPC 354D."},
                "emotional_impact": ["Fear", "Distress"],
                "urgency": "CRITICAL",
                "legal_references": ["IPC 354D — Stalking"],
            }
        }


class AnalysisLogEntry(BaseModel):
    """Entry stored in the evidence log."""
    analysis_id: str
    timestamp: datetime
    message: str
    label: str
    confidence: float
    reason: str
    risk_factors: List[dict]
    risk_score: float


class AlertPayload(BaseModel):
    """Slack alert payload structure."""
    message: str
    label: str
    confidence: float
    reason: str
    risk_score: float
    analysis_id: str
    timestamp: str


class HealthCheck(BaseModel):
    """Health check response."""
    status: str
    version: str
    ai_engine: str
    storage: str
    timestamp: str
