"""
Emotion Engine — Emotional Analysis and Support System.
Analyzes emotional impact and generates supportive coaching messages.
"""

from typing import Dict, Any
from utils.logger import setup_logger

logger = setup_logger(__name__)


class EmotionEngine:

    def __init__(self):
        self.support_messages = {
            "dangerous": [
                "Your safety is the top priority right now. You did nothing wrong.",
                "This message contains threatening behavior that is not acceptable.",
                "Please consider reaching out to a trusted friend or family member.",
                "You deserve to feel safe. Help is available.",
            ],
            "suspicious": [
                "Trust your instincts. If something feels wrong, it probably is.",
                "It's okay to be cautious. Take your time before responding.",
                "You have the right to set boundaries and protect your space.",
            ],
            "safe": [
                "This conversation appears to be safe, but stay vigilant.",
                "Remember: your safety matters. Trust your instincts always.",
            ],
        }

    def analyze(self, ai_result: Dict[str, Any]) -> Dict[str, Any]:
        label = ai_result.get("label", "safe")
        analysis = ai_result.get("analysis", {})
        patterns = analysis.get("patterns", [])
        risk_factors = analysis.get("risk_factors", [])

        emotional_indicators = self._detect_emotional_indicators(
            patterns, risk_factors, label
        )

        state = self._determine_emotional_state(label, emotional_indicators)
        message = self._generate_support_message(label, emotional_indicators)

        return {"state": state, "message": message, "indicators": emotional_indicators}

    def _detect_emotional_indicators(
        self, patterns: list, risk_factors: list, label: str
    ) -> list:
        indicators = []

        pattern_mapping = {
            "stalking": ["fear", "anxiety", "distress"],
            "gaslighting": ["confusion", "self-doubt", "distress"],
            "coercion": ["pressure", "fear", "anxiety"],
            "intimidation": ["fear", "anxiety", "distress"],
            "love-bombing": ["confusion", "overwhelm"],
            "isolation": ["loneliness", "dependence", "confusion"],
            "sexual harassment": ["violation", "distress", "fear"],
            "blackmail": ["fear", "anxiety", "trapped"],
            "doxxing": ["fear", "violation", "panic"],
        }

        for pattern in patterns:
            pattern_lower = pattern.lower()
            if pattern_lower in pattern_mapping:
                indicators.extend(pattern_mapping[pattern_lower])

        if label == "dangerous":
            indicators.extend(["fear", "distress", "anxiety"])
        elif label == "suspicious":
            indicators.extend(["caution", "unease", "doubt"])

        return list(set(indicators))

    def _determine_emotional_state(self, label: str, indicators: list) -> str:
        if label == "dangerous":
            return "fearful / distressed"
        elif label == "suspicious":
            return "cautious / uncertain"
        return "neutral / safe"

    def _generate_support_message(self, label: str, indicators: list) -> str:
        messages = self.support_messages.get(label, self.support_messages["safe"])

        base_message = messages[0]

        if "fear" in indicators or "anxiety" in indicators:
            base_message += (
                " It's completely normal to feel afraid when someone threatens you."
            )
        elif "isolation" in indicators:
            base_message += (
                " Remember, you are not alone. Reach out to someone you trust."
            )
        elif "confusion" in indicators or "self-doubt" in indicators:
            base_message += " What you're feeling is valid. Trust your instincts."

        return base_message
