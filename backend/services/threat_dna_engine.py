"""
Threat DNA Engine — Pattern Matching System.
Matches messages against known abuse patterns and provides explanations.
"""

import re
from typing import Dict, List, Any
from utils.logger import setup_logger

logger = setup_logger(__name__)


class ThreatDNAEngine:

    def __init__(self):
        self.patterns = self._load_patterns()

    def _load_patterns(self) -> Dict[str, Dict[str, Any]]:
        return {
            "stalking": {
                "keywords": [
                    r"watch(ing|ed|es)?\s+you",
                    r"know\s+where\s+you\s+(live|are|work)",
                    r"follow(ed|ing|s)?\s+you",
                    r"can'?t\s+escape",
                    r"find\s+you",
                    r"always\s+see\s+you",
                ],
                "weight": 0.85,
                "explanation": "Persistent surveillance behavior indicating obsessive monitoring",
                "context": "Stalking is a predictor of physical violence. 76% of femicide victims experience stalking."
            },
            "coercion": {
                "keywords": [
                    r"you\s+have\s+to",
                    r"you\s+must",
                    r"if\s+you\s+(don'?t|won'?t)",
                    r"no\s+choice",
                    r"comply",
                ],
                "weight": 0.75,
                "explanation": "Use of force or threat to compel compliance",
                "context": "Coercion often escalates to physical abuse."
            },
            "gaslighting": {
                "keywords": [
                    r"you\s+are\s+(crazy|mad|delusional)",
                    r"that\s+never\s+happened",
                    r"you\s+imagined\s+it",
                    r"stop\s+lying",
                    r"you\s+forgot",
                ],
                "weight": 0.80,
                "explanation": "Psychological manipulation to make victim doubt reality",
                "context": "Gaslighting is a form of psychological abuse that erodes self-trust."
            },
            "intimidation": {
                "keywords": [
                    r"don'?t\s+(mess|play)\s+with\s+me",
                    r"you\s+will\s+(regret|pay)",
                    r"dangerous",
                    r"hurt\s+you",
                    r"kill\s+you",
                ],
                "weight": 0.90,
                "explanation": "Use of threats to frighten and control",
                "context": "Intimidation is a red flag for physical violence."
            },
            "love-bombing": {
                "keywords": [
                    r"can'?t\s+live\s+without\s+you",
                    r"you\s+are\s+my\s+(everything|life|world)",
                    r"love\s+you\s+so\s+much",
                    r"perfect\s+(together|match)",
                    r"never\s+leave\s+you",
                ],
                "weight": 0.60,
                "explanation": "Excessive attention and affection to establish control",
                "context": "Love-bombing is often followed by isolation and abuse."
            },
            "isolation": {
                "keywords": [
                    r"(don'?t|stop)\s+(talk|hangout)\s+with",
                    r"they\s+(hate|don'?t\s+like)\s+you",
                    r"nobody\s+else\s+(loves|wants)\s+you",
                    r"only\s+me",
                    r"cutting\s+you\s+off",
                ],
                "weight": 0.70,
                "explanation": "Controlling behavior to isolate victim from support",
                "context": "Isolation removes victim's support system and increases dependency."
            },
            "sexual harassment": {
                "keywords": [
                    r"send\s+(me\s+)?(pic|photo|image)s?",
                    r"(nude|sexy|naked)",
                    r"sexual\s+favor",
                    r"do\s+what\s+I\s+say",
                ],
                "weight": 0.85,
                "explanation": "Unwanted sexual attention or demands",
                "context": "Sexual harassment can escalate to assault."
            },
            "revenge threat": {
                "keywords": [
                    r"share\s+your\s+(photo|video|image)",
                    r"expose\s+you",
                    r"send\s+to\s+everyone",
                    r"ruin\s+your\s+(reputation|name)",
                ],
                "weight": 0.90,
                "explanation": "Threat to share private content or information",
                "context": "Revenge porn is a criminal offense under IT Act."
            },
            "blackmail": {
                "keywords": [
                    r"(do|give)\s+what\s+I\s+say\s+or\s+else",
                    r"keep\s+(it\s+)?quiet",
                    r"tell\s+(everyone|nobody)",
                    r"secret",
                ],
                "weight": 0.85,
                "explanation": "Using threats to obtain compliance",
                "context": "Blackmail is a criminal offense under IPC."
            },
        }

    def match_patterns(self, message: str) -> List[Dict[str, Any]]:
        message_lower = message.lower()
        matches = []

        for pattern_name, pattern_data in self.patterns.items():
            for keyword_regex in pattern_data["keywords"]:
                if re.search(keyword_regex, message_lower):
                    matches.append({
                        "pattern": pattern_name,
                        "match": int(pattern_data["weight"] * 100),
                        "explanation": pattern_data["explanation"],
                        "real_world_context": pattern_data["context"]
                    })
                    break

        return matches

    def get_all_patterns(self) -> List[str]:
        return list(self.patterns.keys())