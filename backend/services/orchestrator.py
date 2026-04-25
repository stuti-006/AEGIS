"""
Orchestrator — THE CORE BRAIN.
Coordinates all services: AI Engine, Context Engine, Threat DNA Engine, Emotion Engine.
"""

import hashlib
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from services.ai_engine import AIEngine
from services.context_engine import ContextEngine
from services.threat_dna_engine import ThreatDNAEngine
from services.emotion_engine import EmotionEngine
from services.storage_service import StorageService
from services.alert_service import AlertService
from services.report_service import ReportService
from utils.logger import setup_logger

logger = setup_logger(__name__)


class Orchestrator:

    def __init__(self):
        self.ai_engine = AIEngine()
        self.context_engine = ContextEngine()
        self.threat_dna = ThreatDNAEngine()
        self.emotion_engine = EmotionEngine()
        self.storage_service = StorageService()
        self.alert_service = AlertService()
        self.report_service = ReportService()
        logger.info("Orchestrator initialized with all engines")

    def process(
        self, message: str, user_id: str = "anonymous", language: str = "en"
    ) -> Dict[str, Any]:
        analysis_id = f"ana_{uuid.uuid4().hex[:12]}"
        timestamp = datetime.utcnow().isoformat() + "Z"

        logger.info(f"Processing message for user={user_id}, analysis_id={analysis_id}")

        # 1. Get history and run AI analysis
        history = self.context_engine.get_user_history(user_id)
        ai_result = self.ai_engine.analyze(message=message, language=language)

        # 2. Update context memory
        self.context_engine.store_message(user_id, message)

        # 3. Detect escalation (rules-based augmentation)
        escalation = self.context_engine.detect_escalation(
            history + [{"message": message, "timestamp": datetime.utcnow()}]
        )

        # Merge escalation from context engine if AI missed it
        if escalation["detected"] and not ai_result.get("escalation", {}).get(
            "detected"
        ):
            ai_result["escalation"] = {
                "detected": True,
                "type": escalation.get("type", "behavioral escalation"),
                "message": "System detected escalating threat patterns based on history.",
            }
            # Force dangerous if escalation detected
            ai_result["heatmap"]["threat_level"] = "DANGEROUS"
            ai_result["label"] = "dangerous"

        # 4. Final enrichment
        final_label = ai_result.get("label", "safe")
        color = self._get_color(final_label)
        threat_level = final_label.upper()

        # Ensure heatmap has all fields
        ai_result["heatmap"]["color"] = color
        ai_result["color"] = color
        ai_result["threat_level"] = threat_level

        # Add metadata
        ai_result["analysis_id"] = analysis_id
        ai_result["timestamp"] = timestamp
        ai_result["user_id"] = user_id

        # 5. Save to storage (Pass full response for history replay)
        try:
            self.storage_service.save_analysis(ai_result)
        except Exception as e:
            logger.error(f"Storage error: {e}")

        # 6. Trigger alerts for dangerous content
        if final_label == "dangerous":
            try:
                self.alert_service.send_alert(ai_result)
            except Exception as e:
                logger.error(f"Alert error: {e}")

        logger.info(
            f"Analysis complete: label={final_label}, analysis_id={analysis_id}"
        )
        return ai_result

    def _get_color(self, label: str) -> str:
        return {"safe": "GREEN", "suspicious": "YELLOW", "dangerous": "RED"}.get(
            label, "GREEN"
        )

    def _get_legal_references(self, dna_matches: list) -> list:
        references = []
        for match in dna_matches:
            pattern = match.get("pattern", "")
            if pattern == "stalking":
                references.append("IPC 354D — Stalking")
            elif pattern == "intimidation":
                references.append("IPC 506 — Criminal Intimidation")
            elif pattern == "sexual harassment":
                references.append(
                    "IPC 509 — Word, gesture or act intended to insult modesty"
                )
            elif pattern == "revenge threat":
                references.append("IT Act 66E — Privacy Violation")
            elif pattern == "blackmail":
                references.append("IPC 506 — Blackmail/Criminal Intimidation")
        return list(set(references))

    def _get_legal_explanation(self, dna_matches: list) -> str:
        if not dna_matches:
            return "No specific legal sections triggered."
        explanations = []
        for match in dna_matches:
            if match.get("pattern") == "stalking":
                explanations.append(
                    "Stalking is punishable under IPC 354D with imprisonment up to 3 years."
                )
            elif match.get("pattern") == "intimidation":
                explanations.append(
                    "Criminal intimidation is punishable under IPC 506."
                )
        return (
            " ".join(explanations)
            if explanations
            else "Consult legal counsel for specific advice."
        )

    def _extract_locations(self, message: str) -> list:
        location_keywords = [
            "home",
            "house",
            "address",
            "location",
            "city",
            "outside",
            "street",
        ]
        return [kw for kw in location_keywords if kw in message.lower()]

    def _extract_time_references(self, message: str) -> list:
        time_keywords = ["tonight", "tomorrow", "today", "soon", "later", "now", "wait"]
        return [kw for kw in time_keywords if kw in message.lower()]

    def _recommend_actions(self, label: str) -> list:
        if label == "dangerous":
            return [
                "Do not respond to the sender",
                "Save all evidence immediately",
                "Alert a trusted contact",
                "Consider contacting authorities",
                "Block the sender if possible",
            ]
        elif label == "suspicious":
            return [
                "Monitor the conversation closely",
                "Avoid engaging further",
                "Save the message as evidence",
                "Tell someone you trust about the situation",
            ]
        return ["Trust your instincts", "Stay aware of the conversation context"]
