"""
AEGIS Semantic Matcher — catches slang, paraphrases, and out-of-vocabulary threats
that the keyword/regex engine misses.

Uses sentence-transformers (all-MiniLM-L6-v2, ~80 MB, runs on CPU) to compare
the incoming message against a library of known threat phrases by meaning, not
exact words.

Examples it catches that keywords miss:
  "imma slide to ur crib rn"          → stalking  (87% similar to "I'm coming to your house")
  "u btr watch urself fam"            → intimidation
  "gonna end u no cap"                → violence
  "send sum pics of urself rn"        → sexual harassment
  "nobody gon believe u anyway lol"   → gaslighting
  "ur mine and u cant leave"          → coercion

Completely additive — if sentence-transformers is not installed, this module
silently returns an empty result and the rules engine runs as normal.
"""

from __future__ import annotations
import os
from typing import List, Dict, Tuple
from utils.logger import setup_logger

logger = setup_logger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Threat phrase library — canonical English phrases covering each category.
# The model generalises these to slang / paraphrases automatically.
# ──────────────────────────────────────────────────────────────────────────────
THREAT_PHRASES: List[Tuple[str, str, str]] = [
    # (phrase, category, severity)

    # Stalking / location — standard + slang variants
    ("I am coming to your house right now",             "stalking", "high"),
    ("I know where you live and I will find you",       "stalking", "high"),
    ("I am watching you and following your every move", "stalking", "high"),
    ("I am standing outside your building",             "stalking", "high"),
    ("I tracked your location",                         "stalking", "high"),
    ("Come outside right now",                          "stalking", "high"),
    ("I will show up at your place",                    "stalking", "high"),
    # slang
    ("imma slide to ur crib",                           "stalking", "high"),
    ("ima pull up to ur place rn",                      "stalking", "high"),
    ("im outside ur house rn",                          "stalking", "high"),
    ("i kno where u stay",                              "stalking", "high"),
    ("bout to pull up on u",                            "stalking", "high"),
    ("i been watchin u",                                "stalking", "high"),

    # Violence — standard + slang
    ("I am going to hurt you badly",                    "violence", "high"),
    ("I will kill you",                                 "violence", "high"),
    ("You are going to regret this I will end you",     "violence", "high"),
    ("I will make you pay for this",                    "violence", "high"),
    ("You won't survive this",                          "violence", "high"),
    # slang
    ("gonna end u no cap",                              "violence", "high"),
    ("ima body u fam",                                  "violence", "high"),
    ("ur done bro on god",                              "violence", "high"),
    ("catch these hands",                               "violence", "high"),
    ("u finna get it",                                  "violence", "high"),
    ("its on sight when i see u",                       "violence", "high"),

    # Blackmail / revenge porn
    ("I have your private photos and I will leak them", "blackmail", "high"),
    ("I will post your pictures online if you don't",   "blackmail", "high"),
    ("I recorded you and will share it everywhere",     "blackmail", "high"),
    # slang
    ("i got ur nudes ima drop em",                      "blackmail", "high"),
    ("ill expose u if u dont",                          "blackmail", "high"),
    ("i got receipts ima blast u",                      "blackmail", "high"),

    # Sexual harassment — standard + slang
    ("Send me naked photos of yourself",                "sexual_harassment", "high"),
    ("Show me your body right now",                     "sexual_harassment", "high"),
    ("I want to have sex with you",                     "sexual_harassment", "high"),
    ("Send me something sexy",                          "sexual_harassment", "high"),
    # slang
    ("send sum pics of urself rn",                      "sexual_harassment", "high"),
    ("send nudes rn no cap",                            "sexual_harassment", "high"),
    ("show me ur body bb",                              "sexual_harassment", "high"),
    ("u tryna link and smash",                          "sexual_harassment", "high"),

    # Coercion / control — standard + slang
    ("You belong to me and you cannot leave",           "coercion", "high"),
    ("You have no choice but to do what I say",         "coercion", "high"),
    ("I own you and you will obey me",                  "coercion", "high"),
    ("Do it or else I will destroy you",                "coercion", "high"),
    # slang
    ("ur mine and u cant leave",                        "coercion", "high"),
    ("u belong to me no cap",                           "coercion", "high"),
    ("do it or else im not playing",                    "coercion", "high"),
    ("u aint going nowhere",                            "coercion", "high"),

    # Gaslighting — standard + slang
    ("Nobody will ever believe you",                    "gaslighting", "high"),
    ("You are crazy and imagining things",              "gaslighting", "high"),
    ("You are overreacting as always",                  "gaslighting", "medium"),
    ("That never happened you are lying",               "gaslighting", "medium"),
    # slang
    ("nobody gon believe u anyway lol",                 "gaslighting", "high"),
    ("ur trippin nobody cares",                         "gaslighting", "high"),
    ("ur so dramatic stop making stuff up",             "gaslighting", "medium"),
    ("that never happened ur lying fr",                 "gaslighting", "medium"),

    # Intimidation — standard + slang
    ("Watch your back because I am coming for you",     "intimidation", "high"),
    ("You better be careful I am warning you",          "intimidation", "medium"),
    ("You will see what happens to you",                "intimidation", "medium"),
    # slang
    ("u btr watch urself fam",                          "intimidation", "high"),
    ("sleep with one eye open",                         "intimidation", "high"),
    ("u gonna see wassup real soon",                    "intimidation", "medium"),
    ("dont try me or ull regret it",                    "intimidation", "medium"),

    # Isolation
    ("No one cares about you except me",                "isolation", "medium"),
    ("Your friends and family don't love you",          "isolation", "medium"),
    ("I am the only one who will ever love you",        "isolation", "medium"),
    # slang
    ("nobody else wants u only me",                     "isolation", "medium"),
    ("ur friends dont actually care abt u",             "isolation", "medium"),

    # Romance scam
    ("I am stuck abroad and need you to send money",    "romance_scam", "high"),
    ("My phone broke please save this new number",      "romance_scam", "high"),
    ("You are the only person I trust please help me",  "romance_scam", "high"),
    ("Send me money and I will pay you back I promise", "romance_scam", "high"),

    # Harassment / insults
    ("You are worthless and disgusting",                "harassment", "medium"),
    ("You are a slut and everyone knows it",            "harassment", "high"),
    ("You deserve everything bad that happens to you",  "harassment", "medium"),
    # slang
    ("ur such a hoe fr",                                "harassment", "high"),
    ("ur trash and everyone knows it",                  "harassment", "medium"),
    ("u deserve everything coming to u",                "harassment", "medium"),
]

# Similarity threshold — tune this:
#   0.60 = more sensitive (catches more slang, some false positives)
#   0.72 = balanced (recommended)
#   0.80 = strict (fewer false positives, may miss heavy slang)
SIMILARITY_THRESHOLD = 0.55


class SemanticMatcher:
    """
    Lightweight semantic similarity engine.
    Loads once at startup, then each call is ~5-15ms on CPU.
    """

    def __init__(self):
        self._model = None
        self._phrase_embeddings = None
        self._ready = False
        self._load()

    def _load(self):
        """Load model — silently skip if sentence-transformers not installed."""
        try:
            from sentence_transformers import SentenceTransformer
            import numpy as np

            model_name = os.getenv("SEMANTIC_MODEL", "all-MiniLM-L6-v2")
            logger.info(f"Loading semantic model: {model_name}")
            self._model = SentenceTransformer(model_name)

            # Pre-encode all threat phrases once
            phrases = [p[0] for p in THREAT_PHRASES]
            self._phrase_embeddings = self._model.encode(
                phrases, convert_to_numpy=True, normalize_embeddings=True
            )
            self._ready = True
            logger.info(
                f"Semantic matcher ready — {len(THREAT_PHRASES)} threat phrases encoded"
            )
        except ImportError:
            logger.warning(
                "sentence-transformers not installed — semantic matching disabled. "
                "Run: pip install sentence-transformers"
            )
        except Exception as e:
            logger.warning(f"Semantic matcher failed to load ({e}) — disabled")

    def match(self, message: str) -> List[Dict]:
        """
        Compare message against threat phrase library.

        Returns list of matches above threshold, sorted by similarity desc.
        Each match: {category, severity, similarity, matched_phrase, description}
        """
        if not self._ready or not message.strip():
            return []

        try:
            import numpy as np

            msg_emb = self._model.encode(
                [message], convert_to_numpy=True, normalize_embeddings=True
            )
            # Cosine similarity (embeddings are L2-normalised so dot product = cosine)
            scores = (self._phrase_embeddings @ msg_emb.T).flatten()

            matches = []
            seen_categories = set()

            for idx in scores.argsort()[::-1]:
                score = float(scores[idx])
                if score < SIMILARITY_THRESHOLD:
                    break

                phrase, category, severity = THREAT_PHRASES[idx]

                # One match per category — take the highest scoring one
                if category in seen_categories:
                    continue
                seen_categories.add(category)

                matches.append({
                    "category":      category,
                    "severity":      severity,
                    "similarity":    round(score * 100, 1),
                    "matched_phrase": phrase,
                    "description":   (
                        f"Semantic match ({score * 100:.0f}% similar to known {category} pattern): "
                        f'"{phrase}"'
                    ),
                })

            return matches

        except Exception as e:
            logger.warning(f"Semantic match error: {e}")
            return []

    @property
    def is_ready(self) -> bool:
        return self._ready


# ── Singleton — loaded once when the module is first imported ──
_instance: SemanticMatcher | None = None


def get_semantic_matcher() -> SemanticMatcher:
    global _instance
    if _instance is None:
        _instance = SemanticMatcher()
    return _instance
