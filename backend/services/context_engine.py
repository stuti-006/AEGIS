"""
Context Engine — Escalation Detection System.
Tracks conversation history per user and detects escalating threat patterns.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from utils.logger import setup_logger

logger = setup_logger(__name__)


class ContextEngine:

    def __init__(self):
        self.memory: Dict[str, List[Dict[str, Any]]] = {}

    def get_user_history(self, user_id: str) -> List[Dict[str, Any]]:
        return self.memory.get(user_id, [])

    def store_message(self, user_id: str, message: str) -> None:
        if user_id not in self.memory:
            self.memory[user_id] = []

        self.memory[user_id].append(
            {"message": message, "timestamp": datetime.utcnow()}
        )

    def detect_escalation(self, messages: List[Any]) -> Dict[str, Any]:
        if len(messages) < 3:
            return {"detected": False, "type": None}

        timestamps = [
            m["timestamp"] if isinstance(m, dict) else datetime.utcnow()
            for m in messages
        ]

        recent = [t for t in timestamps if t > datetime.utcnow() - timedelta(minutes=5)]

        if len(recent) > 5:
            return {"detected": True, "type": "spam / obsession"}

        danger_words = ["kill", "come", "watching", "outside", "find you", "hurt"]

        score = sum(
            any(
                word in (m["message"] if isinstance(m, dict) else m).lower()
                for word in danger_words
            )
            for m in messages
        )

        if score >= 2:
            return {"detected": True, "type": "escalating threat"}

        return {"detected": False, "type": None}

    def clear_user_history(self, user_id: str) -> None:
        if user_id in self.memory:
            del self.memory[user_id]
