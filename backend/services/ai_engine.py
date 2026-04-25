"""
GUARDIANTEXT — Full Multi-Stage AI Safety Intelligence Engine.
Powers 5 wow features: Heatmap, OCR-to-Threat, Threat DNA, Evidence, Coaching.
"""

import json
import os
import re
import uuid
from datetime import datetime
from typing import Dict, List
from utils.logger import setup_logger
from services.semantic_matcher import get_semantic_matcher

logger = setup_logger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# GUARDIANTEXT ORCHESTRATION PROMPT — THE STORYTELLER
# ──────────────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are GUARDIANTEXT — a threat analyst for women's online safety.

Analyze the message and respond with ONLY valid JSON. Be fast and accurate.

CLASSIFICATION:
- DANGEROUS: direct threats, stalking, blackmail, sexual coercion, violence, severe harassment
- SUSPICIOUS: implied threats, manipulation, coercion, boundary violations
- SAFE: genuinely benign

SCORING: risk_score — SAFE: 5-25, SUSPICIOUS: 30-65, DANGEROUS: 65-100

{
  "heatmap": {"threat_level": "SAFE|SUSPICIOUS|DANGEROUS", "confidence": 0, "risk_score": 0, "toxicity": 0},
  "summary": "One sentence.",
  "story": "2 sentences max.",
  "breakdown": [{"title": "", "description": "", "severity": "low|medium|high"}],
  "threat_dna": [{"pattern": "", "match": 0, "explanation": "", "cases": 0}],
  "escalation": {"detected": false, "type": "", "message": ""},
  "insights": [],
  "emotional_impact": [],
  "actions": [{"step": 1, "action": ""}],
  "conversation": {"conversation_tag": "threatening|normal|escalating", "summary": ""}
}"""

# Keep old name as alias for any references
# ──────────────────────────────────────────────────────────────────────────────
# Rules-based keyword database
# ──────────────────────────────────────────────────────────────────────────────
THREAT_KEYWORDS = {
    "romance_scam": {
        "keywords": [
            "i need to cover",
            "send me money",
            "wire me",
            "transfer money",
            "i need $",
            "need £",
            "need €",
            "venmo me",
            "cash app me",
            "i need funds",
            "pay for my flight",
            "cover my expenses",
            "pay upfront",
            "need upfront",
            "cover upfront",
            "my bag was stolen",
            "passport was stolen",
            "wallet was stolen",
            "stuck at the airport",
            "stranded abroad",
            "embassy stuff",
            "private channel",
            "only person i trust",
            "you're the only one",
            "you're the only person",
            "can you help me with money",
            "borrow some money",
            "lend me",
            "i'll pay you back",
            "supply run",
            "military deployment",
            "working offshore",
            # mum-dad / SIM-swap scam patterns
            "delete that number and save this one",
            "delete my old number",
            "save this new number",
            "this is my new number",
            "lost my phone",
            "phone just broke",
            "phone got stolen",
            "new sim",
            "new number",
            "it's me mum",
            "it's me dad",
            "hi mum",
            "hi dad",
            "hi mom",
        ],
        "severity": "high",
    },
    "financial_fraud": {
        "keywords": [
            "investment opportunity",
            "guaranteed returns",
            "double your money",
            "crypto investment",
            "bitcoin transfer",
            "gift card",
            "send gift cards",
            "buy gift cards",
            "itunes card",
            "google play card",
            "amazon card",
            "pay with gift card",
            "lottery win",
            "you've been selected",
            "unclaimed funds",
            "inheritance funds",
            "bank account details",
            "click this link to claim",
            "verify your account",
            "your account will be suspended",
        ],
        "severity": "high",
    },
    "violence": {
        "keywords": [
            "going to kill",
            "will hurt",
            "going to stab",
            "going to shoot",
            "will attack",
            "will harm",
            "i'll find you",
            "you won't escape",
            "i will destroy you",
            "you're dead",
            "going to beat you",
            "i'll make you pay",
            "you'll regret this",
            "i'll end you",
            "i'll ruin you",
            "ruin you completely",
            "destroy your life",
            "make your life hell",
            "you will suffer",
            "face the consequences",
            "or face the consequences",
            "you'll pay for this",
            "i will make sure you",
            "you won't get away",
            "i'll get you",
            "watch your back",
            "you better watch",
        ],
        "severity": "high",
    },
    "self_harm": {
        "keywords": [
            "kill myself",
            "hurt myself",
            "hang myself",
            "take my life",
            "end my life",
            "cut myself",
            "don't want to live",
        ],
        "severity": "high",
    },
    "stalking": {
        "keywords": [
            "i know where you live",
            "i know where you work",
            "i know your address",
            "i know your route",
            "i know your schedule",
            "i know your kids",
            "i know where your kids",
            "i know your children",
            "i know your school",
            "i waited for you",
            "i'm watching you",
            "i'm following you",
            "i'm outside",
            "i followed you",
            "i saw you today",
            "i can see you",
            "i tracked you",
            "outside your house",
            "outside your home",
            "outside your apartment",
            "outside your flat",
            "outside your door",
            "outside your building",
            "outside your place",
            "outside your work",
            "outside your office",
            "outside your school",
            "outside your college",
            "right outside",
            "just outside",
            "i'm coming for you",
            "i'm coming tonight",
            "i'm coming to get you",
            "come out right now",
            "come out now",
            "i found you",
            "i located you",
            "i can find you",
            "meet me alone",
            "meet me tonight",
            "come alone",
        ],
        "severity": "high",
    },
    "sexual_harassment": {
        "keywords": [
            "send me photos",
            "send me pictures",
            "send nudes",
            "show me your body",
            "you're sexy",
            "i want you sexually",
            "let's have sex",
            "sleep with me",
            "i'll touch you",
            "sexual favors",
            "dress sexy for me",
            "you look hot",
        ],
        "severity": "high",
    },
    "blackmail": {
        "keywords": [
            "i have your photos",
            "i'll leak",
            "i'll share your pictures",
            "pay me or",
            "i recorded you",
            "i have screenshots of you",
            "i'll post your photos",
            "release your videos",
        ],
        "severity": "high",
    },
    "coercion": {
        "keywords": [
            "do it or else",
            "you have no choice",
            "if you don't",
            "i'll tell everyone",
            "tell anyone and",
            "if you tell anyone",
            "don't tell anyone",
            "keep this between us or",
            "you belong to me",
            "you can't leave",
            "you will do this",
            "you must obey",
            "do what i say",
            "you have to listen to me",
            "no one else will have you",
            "i own you",
            "you're mine",
            "you can't say no to me",
            "or else",
            "better do what i say",
            "you know what will happen",
        ],
        "severity": "high",
    },
    "gaslighting": {
        "keywords": [
            "you're crazy",
            "that never happened",
            "you're imagining things",
            "no one will believe you",
            "you're overreacting",
        ],
        "severity": "high",
    },
    "blackmail": {
        "keywords": [
            "i have your photos",
            "i'll leak",
            "i'll share your pictures",
            "pay me or",
            "i recorded you",
        ],
        "severity": "high",
    },
    "harassment": {
        "keywords": [
            "motherfucker",
            "mother fucker",
            "mf",
            "screw you",
            "fuck you",
            "f you",
            "go to hell",
            "piece of shit",
            "you piece of",
            "son of a bitch",
            "bastard",
            "asshole",
            "you're an idiot",
            "ur an idiot",
            "stupid bitch",
            "dumb bitch",
            "ugly bitch",
            "fat bitch",
            "shut up bitch",
            "shut the fuck up",
            "stfu",
            "go fuck yourself",
            "get lost",
            "drop dead",
            "i hate you",
            "i despise you",
            "you disgust me",
            "you make me sick",
        ],
        "severity": "high",
    },
    "cybercrime": {
        "keywords": [
            "hack",
            "ddos",
            "malware",
            "ransomware",
            "phishing",
            "steal credit card",
        ],
        "severity": "medium",
    },
}

TARGETED_HARASSMENT_PATTERNS = [
    # ── Standalone slurs ──
    (
        re.compile(
            r"\b(?:slut|whore|bitch|hoe|skank|prostitute|cheap girl|randi|kutti|haramzadi|kamini|characterless)\b"
        ),
        "harassment", "high",
        "Detected degrading or sexually abusive slur.",
    ),
    # ── Degrading insults ──
    (
        re.compile(
            r"\b(?:you(?:'re| are)?|ur|u r)\s+"
            r"(?:worthless|disgusting|pathetic|filthy|characterless)\b"
        ),
        "harassment", "medium",
        "Detected targeted degrading insult.",
    ),
    # ── Explicit image solicitation ──
    (
        re.compile(
            r"\b(?:show|send)\s+(?:me\s+)?(?:your\s+)?(?:nudes|pics|pictures|photos)\b"
        ),
        "harassment", "high",
        "Detected sexual coercion or explicit-image solicitation.",
    ),
    # ── Stalking / location ──
    (
        re.compile(
            r"(?:right\s+|just\s+)?outside\s+your\s+"
            r"(?:house|home|apartment|flat|door|building|place|work|office|school|college)"
        ),
        "stalking", "high",
        "Detected location-based surveillance threat near victim's premises.",
    ),
    (
        re.compile(
            r"i(?:'m| am)\s+(?:right\s+|just\s+)?(?:outside|watching|following|waiting|nearby|close)"
        ),
        "stalking", "high",
        "Detected real-time surveillance or proximity threat.",
    ),
    (
        re.compile(r"come\s+out\s+(?:right\s+now|now|outside|please)"),
        "stalking", "high",
        "Detected demand to leave safety — classic stalking escalation.",
    ),
    (
        re.compile(r"i(?:'m| am)\s+coming\s+(?:for\s+you|tonight|now|over|to\s+get\s+you)"),
        "violence", "high",
        "Detected explicit threat to physically approach or harm victim.",
    ),
    (
        re.compile(r"i\s+(?:found|located|tracked|followed)\s+you"),
        "stalking", "high",
        "Detected admission of tracking or locating the victim.",
    ),
    # ── Coercion / silence threats ──
    (
        re.compile(r"(?:tell|told)\s+anyone\s+and\s+(?:i(?:'ll| will)|you(?:'ll| will))"),
        "coercion", "high",
        "Detected silence threat — classic coercive control tactic.",
    ),
    (
        re.compile(r"(?:meet|come)\s+(?:me\s+)?alone\s+(?:tonight|now|or|and)"),
        "stalking", "high",
        "Detected demand to meet alone — isolation and control tactic.",
    ),
    (
        re.compile(r"(?:or\s+)?face\s+the\s+consequences"),
        "coercion", "high",
        "Detected explicit threat of consequences — criminal intimidation.",
    ),
    (
        re.compile(r"i(?:'ll| will)\s+(?:ruin|destroy|expose|finish)\s+you"),
        "violence", "high",
        "Detected threat to ruin or destroy victim.",
    ),
    # ── Child/family targeting ──
    (
        re.compile(r"i\s+know\s+(?:your\s+)?(?:kids?|children|son|daughter|family)\s+(?:school|schedule|address|route|location)"),
        "stalking", "high",
        "Detected threat involving victim's children or family — severe escalation.",
    ),
    # ── Gaslighting ──
    (
        re.compile(r"(?:no\s*body|no\s+one)\s+will\s+believe\s+you"),
        "gaslighting", "high",
        "Detected isolation tactic — undermining victim's credibility.",
    ),
    # ── SIM-swap / family impersonation scam ──
    (
        re.compile(
            r"(?:hi|hey|it'?s me)[,\s]+(?:mum|mom|dad|sis|bro|son|daughter)"
            r".*(?:new number|new sim|broke|stolen|lost my phone|delete.*number|save this number)",
            re.DOTALL | re.IGNORECASE,
        ),
        "romance_scam", "high",
        "Detected mum-dad / SIM-swap scam.",
    ),
    (
        re.compile(
            r"(?:delete|remove)\s+(?:that|my old|the old)\s+number"
            r"|save\s+(?:this|my new)\s+(?:number|contact)",
            re.IGNORECASE,
        ),
        "romance_scam", "high",
        "Detected SIM-swap / number-replacement scam tactic.",
    ),
    (
        re.compile(r"i(?:'ll| will)\s+(?:leak|post|share|send|release|expose)\s+your"),
        "blackmail", "high",
        "Detected threat to expose private content — image-based abuse.",
    ),
]

LEGAL_MAP = {
    "stalking": "IPC 354D — Stalking",
    "harassment": "IPC 509 — Insult to modesty of a woman",
    "insults": "IPC 509 — Insult to modesty of a woman",
    "sexual_harassment": "IPC 354A — Sexual harassment / IPC 509",
    "coercion": "IPC 506 — Criminal intimidation",
    "intimidation": "IPC 506 — Criminal intimidation",
    "violence": "IPC 506 — Criminal intimidation",
    "cybercrime": "IT Act 66E / 67 — Cybercrime / obscene content",
    "blackmail": "IT Act 66E / 67 — Privacy violation / obscene content",
    "gaslighting": "Protection of Women from Domestic Violence Act, 2005",
    "isolation": "Protection of Women from Domestic Violence Act, 2005",
    "love_bombing": "Protection of Women from Domestic Violence Act, 2005",
    "romance_scam": "IPC 420 — Cheating / IPC 66D IT Act — Fraud",
    "financial_fraud": "IPC 420 — Cheating / IPC 66D IT Act — Online fraud",
}

THREAT_DNA_DESCRIPTIONS = {
    "stalking": (
        "Monitoring or pursuing a person persistently",
        "Stalkers often escalate from online tracking to physical surveillance. 76% of femicide victims were stalked beforehand.",
    ),
    "coercion": (
        "Using threats or force to compel behaviour",
        "Coercive control restricts autonomy and is recognised as criminal intimidation under IPC 506.",
    ),
    "gaslighting": (
        "Making the victim doubt their own reality",
        "Gaslighting erodes self-trust and is a hallmark of psychologically abusive relationships.",
    ),
    "harassment": (
        "Unwanted aggressive or degrading communication",
        "Online harassment of women often escalates to real-world threats when left unchecked.",
    ),
    "insults": (
        "Targeted degrading or abusive language",
        "Repeated insults constitute emotional abuse and can meet the threshold for IPC 509 — insult to modesty.",
    ),
    "sexual_harassment": (
        "Unwanted sexual advances or explicit demands",
        "Sexual harassment online is punishable under IPC 354A and IPC 509.",
    ),
    "intimidation": (
        "Veiled or explicit threats to cause fear",
        "Intimidation is a predictor of physical violence and punishable under IPC 506.",
    ),
    "isolation": (
        "Cutting the victim off from support networks",
        "Isolation is a core tactic in coercive control and domestic abuse patterns.",
    ),
    "love_bombing": (
        "Overwhelming affection to create dependency",
        "Love bombing is an early-stage manipulation tactic used to establish emotional control.",
    ),
    "romance_scam": (
        "Building fake emotional connection to extract money",
        "Romance scammers target women on social media / dating apps — 'bag stolen abroad' and 'only you I trust' are classic patterns. Report to cybercrime.gov.in.",
    ),
    "financial_fraud": (
        "Deceptive request for money or financial information",
        "Online financial fraud targeting women is punishable under IPC 420 and IT Act 66D. Never send money or card details to someone you haven't met.",
    ),
    "violence": (
        "Explicit or implicit threat of physical harm",
        "Threats of violence, even when vague, are criminal offences and strong predictors of actual harm.",
    ),
    "blackmail": (
        "Leveraging private information for control",
        "Image-based abuse and sextortion disproportionately target women and are punishable under IT Act.",
    ),
    "self_harm": (
        "Expressions of intent to self-harm",
        "Self-harm statements require compassionate response and immediate connection to support resources.",
    ),
    "cybercrime": (
        "Threats involving digital attacks or fraud",
        "Cyber threats can lead to identity theft, financial loss, and psychological distress.",
    ),
}


class AIEngine:
    """GUARDIANTEXT multi-stage threat intelligence engine."""

    def __init__(self):
        self.model = "gpt-4o-mini"
        self.client = None
        self._init_client()

    def _init_client(self):
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()

        if api_key and api_key not in ("sk-your-key-here", "YOUR_NEW_KEY_HERE"):
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=api_key)
                logger.info("OpenAI client initialized (GUARDIANTEXT mode)")
                return
            except Exception as exc:
                logger.warning(f"OpenAI client initialization failed ({exc})")

        if openrouter_key and openrouter_key != "your-openrouter-key-here":
            try:
                from openai import OpenAI
                self.client = OpenAI(
                    api_key=openrouter_key,
                    base_url="https://openrouter.ai/api/v1",
                )
                self.model = "openai/gpt-4o-mini"
                logger.info("OpenRouter client initialized (GUARDIANTEXT mode)")
                return
            except Exception as exc:
                logger.warning(f"OpenRouter client initialization failed ({exc})")

        logger.warning("No API key set — using fallback rules engine")

    # ──────────────────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────────────────
    def analyze(self, message: str, language: str = "en") -> Dict:
        """
        Analyze a message using GPT-4o-mini (GUARDIANTEXT pipeline).
        """
        analysis_id = f"ana_{uuid.uuid4().hex[:12]}"
        logger.info(f"Analyzing message [{analysis_id}]...")

        if not self.client:
            logger.warning("No OpenAI client available — falling back to rules engine")
            return self._analyze_with_rules(message, analysis_id)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": f"Analyze this message for threats:\n\n{message}"},
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
                timeout=8,
                max_tokens=600,
            )

            raw_content = response.choices[0].message.content
            pipe = json.loads(raw_content)

            now = datetime.utcnow().isoformat() + "Z"
            heatmap = pipe.get("heatmap", {})
            threat_level = heatmap.get("threat_level", "SAFE").upper()
            label = threat_level.lower()
            conf_raw = heatmap.get("confidence", 0)
            confidence = conf_raw / 100.0 if conf_raw > 1 else float(conf_raw)
            toxicity = heatmap.get("toxicity", 0)
            risk_score = heatmap.get("risk_score", 0)
            color = {"SAFE": "GREEN", "SUSPICIOUS": "YELLOW", "DANGEROUS": "RED"}.get(threat_level, "GREEN")

            # Normalise threat_dna — LLM uses "cases", frontend expects "real_world_context"
            threat_dna = []
            for d in pipe.get("threat_dna", []):
                threat_dna.append({
                    "pattern": d.get("pattern", ""),
                    "match": d.get("match", 0),
                    "explanation": d.get("explanation", ""),
                    "real_world_context": d.get("real_world_context", "") or (
                        f"Seen in approximately {d.get('cases', 0):,} documented cases." if d.get("cases") else ""
                    ),
                })

            # Normalise breakdown → risk_factors
            risk_factors = []
            for b in pipe.get("breakdown", []):
                risk_factors.append({
                    "factor": b.get("title", b.get("factor", "unknown")),
                    "severity": b.get("severity", "medium"),
                    "description": b.get("description", ""),
                })

            # Normalise actions → recommendations
            recommendations = [a.get("action", a) if isinstance(a, dict) else str(a)
                                for a in pipe.get("actions", [])]

            summary = pipe.get("summary", "")
            escalation_raw = pipe.get("escalation", {})
            patterns = [d.get("pattern", "") for d in threat_dna if d.get("pattern")]
            legal_refs = list({LEGAL_MAP[p] for p in patterns if p in LEGAL_MAP})

            return {
                # ── Core ──
                "analysis_id": analysis_id,
                "timestamp": now,
                "label": label,
                "confidence": confidence,
                "reason": summary,
                "risk_factors": risk_factors,
                "explanation": pipe.get("story", summary),
                "risk_score": float(risk_score),
                "recommendations": recommendations,
                # ── Feature 1: Heatmap ──
                "threat_level": threat_level,
                "color": color,
                "toxicity": toxicity,
                # ── Feature 2 ──
                "tone": "aggressive" if label == "dangerous" else ("cautious" if label == "suspicious" else "neutral"),
                "context_type": "GUARDIANTEXT AI Pipeline",
                # ── Feature 3: Threat DNA ──
                "threat_dna": threat_dna,
                "patterns_detected": patterns,
                # ── Feature 4: Evidence ──
                "evidence": {
                    "message": message,
                    "summary": summary,
                    "threat_level": threat_level,
                    "detected_patterns": patterns,
                    "legal_references": legal_refs,
                    "timestamp": now,
                },
                # ── Feature 5: Coaching ──
                "support_message": self._support_message(label),
                # ── Additional ──
                "entities": {"locations": [], "time": [], "people": []},
                "escalation": {
                    "detected": escalation_raw.get("detected", False),
                    "type": escalation_raw.get("type", "") or escalation_raw.get("message", ""),
                },
                "legal": {
                    "sections": legal_refs,
                    "explanation": "; ".join(legal_refs) if legal_refs else "",
                },
                "emotional_impact": pipe.get("emotional_impact", []),
                "urgency": self._urgency(threat_level, escalation_raw.get("detected", False)),
                "legal_references": legal_refs,
                # ── Storytelling extras ──
                "heatmap": heatmap,
                "summary": summary,
                "story": pipe.get("story", ""),
                "breakdown": pipe.get("breakdown", []),
                "insights": pipe.get("insights", []),
                "actions": pipe.get("actions", []),
                "conversation": pipe.get("conversation", {}),
            }

        except Exception as e:
            logger.warning(f"GPT analysis failed ({type(e).__name__}), using rules engine")
            return self._analyze_with_rules(message, analysis_id)

    # ──────────────────────────────────────────────────────────────────────
    # Rules-based fallback
    # ──────────────────────────────────────────────────────────────────────
    def _analyze_with_rules(self, message: str, analysis_id: str) -> Dict:
        message_lower = message.lower()
        detected_factors: List[Dict] = []
        detected_categories: List[str] = []
        legal_refs: List[str] = []
        max_severity = "safe"
        confidence = 0.0

        for category, threat_data in THREAT_KEYWORDS.items():
            for keyword in threat_data["keywords"]:
                if keyword.lower() in message_lower:
                    detected_factors.append({
                        "factor": category,
                        "severity": threat_data["severity"],
                        "description": f"Detected {category} indicator: '{keyword}'",
                    })
                    if category not in detected_categories:
                        detected_categories.append(category)
                    if threat_data["severity"] == "high":
                        max_severity = "dangerous"
                        confidence = max(confidence, 85)
                    elif threat_data["severity"] == "medium" and max_severity != "dangerous":
                        max_severity = "suspicious"
                        confidence = max(confidence, 65)
                    if category in LEGAL_MAP:
                        ref = LEGAL_MAP[category]
                        if ref not in legal_refs:
                            legal_refs.append(ref)

        for pattern, category, severity, description in TARGETED_HARASSMENT_PATTERNS:
            if not pattern.search(message_lower):
                continue
            detected_factors.append({
                "factor": category,
                "severity": severity,
                "description": description,
            })
            if category not in detected_categories:
                detected_categories.append(category)
            if severity == "high":
                max_severity = "dangerous"
                confidence = max(confidence, 88)
            elif max_severity != "dangerous":
                max_severity = "suspicious"
                confidence = max(confidence, 72)
            if category in LEGAL_MAP:
                ref = LEGAL_MAP[category]
                if ref not in legal_refs:
                    legal_refs.append(ref)

        # ── Semantic similarity pass — only if model already loaded ──────────
        semantic_matcher = get_semantic_matcher()
        if semantic_matcher.is_ready:
            for sem in semantic_matcher.match(message):
                cat = sem["category"]
                sev = sem["severity"]
                if cat not in detected_categories:
                    detected_categories.append(cat)
                    detected_factors.append({
                        "factor":      cat,
                        "severity":    sev,
                        "description": sem["description"],
                    })
                    if sev == "high":
                        max_severity = "dangerous"
                        confidence = max(confidence, round(sem["similarity"] * 0.95, 1))
                    elif max_severity != "dangerous":
                        max_severity = "suspicious"
                        confidence = max(confidence, round(sem["similarity"] * 0.80, 1))
                    if cat in LEGAL_MAP and LEGAL_MAP[cat] not in legal_refs:
                        legal_refs.append(LEGAL_MAP[cat])
        # ────────────────────────────────────────────────────────────────────

        if not detected_factors:
            max_severity = "safe"
            confidence = 95

        threat_level = max_severity.upper()
        color = {"SAFE": "GREEN", "SUSPICIOUS": "YELLOW", "DANGEROUS": "RED"}.get(threat_level, "GREEN")

        # ── Dynamic scoring based on actual detected factors ──────────────
        high_count   = sum(1 for f in detected_factors if f["severity"] == "high")
        medium_count = sum(1 for f in detected_factors if f["severity"] == "medium")
        factor_count = len(detected_factors)

        if max_severity == "safe":
            # Safe: very low base, tiny bump per factor (shouldn't have many)
            risk_score = min(25.0, 5 + factor_count * 2)
            toxicity   = min(20,   3 + factor_count * 2)
        elif max_severity == "suspicious":
            # Suspicious: moderate range 30–65, driven by factor count
            risk_score = min(65.0, 30 + high_count * 8 + medium_count * 4 + (confidence / 5))
            toxicity   = min(60,   25 + high_count * 6 + medium_count * 3)
        else:
            # Dangerous: range 65–100, driven by severity mix
            risk_score = min(100.0, 60 + high_count * 5 + medium_count * 2 + (confidence / 8))
            toxicity   = min(100,   55 + high_count * 5 + medium_count * 2)

        risk_score = round(risk_score, 1)
        # ─────────────────────────────────────────────────────────────────
        escalation_detected = len(detected_categories) >= 2
        now = datetime.utcnow().isoformat() + "Z"
        reason = self._build_reason(max_severity, detected_factors)

        # Build threat DNA
        threat_dna = []
        for cat in detected_categories:
            desc = THREAT_DNA_DESCRIPTIONS.get(cat, ("", ""))
            match_pct = 90 if max_severity == "dangerous" else 55
            threat_dna.append({
                "pattern": cat,
                "match": match_pct,
                "explanation": desc[0] or f"Detected {cat} pattern in message.",
                "real_world_context": desc[1] or "",
            })

        recommendations = self._get_recommendations(max_severity)
        support_msg = self._support_message(max_severity)

        return {
            # ── Core fields (AnalysisResponse schema) ──
            "analysis_id": analysis_id,
            "timestamp": now,
            "label": max_severity,
            "confidence": confidence / 100.0,
            "reason": reason,
            "risk_factors": detected_factors,
            "explanation": self._build_explanation(detected_factors),
            "risk_score": risk_score,
            "recommendations": recommendations,
            # ── Feature 1: Heatmap ──
            "threat_level": threat_level,
            "color": color,
            "toxicity": toxicity,
            # ── Feature 2: Tone/context ──
            "tone": "aggressive" if max_severity == "dangerous" else ("cautious" if max_severity == "suspicious" else "neutral"),
            # Keep this user-facing label neutral (avoid exposing internal fallback implementation).
            "context_type": "AEGIS Automated Detection",
            # ── Feature 3: Threat DNA ──
            "threat_dna": threat_dna,
            "patterns_detected": detected_categories,
            # ── Feature 4: Evidence ──
            "evidence": {
                "message": message,
                "summary": reason,
                "threat_level": threat_level,
                "detected_patterns": detected_categories,
                "legal_references": legal_refs,
                "timestamp": now,
            },
            # ── Feature 5: Coaching ──
            "support_message": support_msg,
            # ── Additional intelligence ──
            "entities": {"locations": [], "time": [], "people": []},
            "escalation": {
                "detected": escalation_detected,
                "type": "multiple threat categories" if escalation_detected else "",
            },
            "legal": {
                "sections": legal_refs,
                "explanation": "; ".join(legal_refs) if legal_refs else "No specific legal sections triggered.",
            },
            "emotional_impact": self._estimate_emotional_impact(max_severity),
            "urgency": self._urgency(threat_level, escalation_detected),
            "legal_references": legal_refs,
            # ── New storytelling fields (for future UI use) ──
            "heatmap": {
                "threat_level": threat_level,
                "confidence": confidence,
                "risk_score": risk_score,
                "toxicity": toxicity,
            },
            "summary": reason,
            "story": f"The message was flagged as {max_severity}. " + (
                "Multiple threat factors were detected, indicating escalation." if escalation_detected
                else "Concerning language was identified."
            ),
            "breakdown": [{"title": f["factor"].replace("_", " ").title(), "description": f["description"], "severity": f["severity"]} for f in detected_factors],
            "insights": [f"Detected {cat}" for cat in detected_categories],
            "actions": [{"step": i + 1, "action": a} for i, a in enumerate(recommendations)],
            "conversation": {
                "conversation_tag": "threatening" if max_severity == "dangerous" else ("escalating" if max_severity == "suspicious" else "normal"),
                "summary": reason,
            },
        }

    # ──────────────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────────────
    @staticmethod
    def _normalise_risk_factors(raw: list) -> List[Dict]:
        out = []
        for item in raw:
            if isinstance(item, str):
                out.append({"factor": item, "severity": "medium", "description": item})
            elif isinstance(item, dict):
                out.append(
                    {
                        "factor": item.get("factor", item.get("name", "unknown")),
                        "severity": item.get("severity", "medium"),
                        "description": item.get("description", ""),
                    }
                )
        return out

    @staticmethod
    def _calculate_risk_score(confidence: float, label: str) -> float:
        base = {"safe": 5, "suspicious": 35, "dangerous": 65}.get(label, 5)
        return min(100.0, base + confidence * 8)

    @staticmethod
    def _urgency(threat_level: str, escalation: bool) -> str:
        if escalation and threat_level == "DANGEROUS":
            return "CRITICAL"
        return {"DANGEROUS": "HIGH", "SUSPICIOUS": "MEDIUM", "SAFE": "LOW"}.get(
            threat_level, "LOW"
        )

    @staticmethod
    def _build_reason(label: str, factors: List[Dict]) -> str:
        if label == "dangerous":
            names = ", ".join(sorted(set(f["factor"] for f in factors)))
            return f"Detected threat indicators: {names}"
        if label == "suspicious":
            return (
                "Message contains potentially concerning language that warrants review."
            )
        return "No harmful content detected. Message appears safe."

    @staticmethod
    def _build_explanation(factors: List[Dict]) -> str:
        if not factors:
            return "No concerning patterns detected. Message appears safe."
        parts = ["Concerning patterns identified:\n"]
        for f in factors:
            parts.append(
                f"• [{f.get('severity','?').upper()}] {f.get('factor','?')}: {f.get('description','')}"
            )
        return "\n".join(parts)

    @staticmethod
    def _estimate_emotional_impact(label: str) -> List[str]:
        return {
            "dangerous": [
                "Fear",
                "Anxiety",
                "Distress",
                "Isolation",
                "Coercion pressure",
            ],
            "suspicious": ["Anxiety", "Unease"],
            "safe": [],
        }.get(label, [])

    @staticmethod
    def _get_recommendations(label: str) -> List[str]:
        return {
            "dangerous": [
                "Block the sender immediately",
                "Document and screenshot all evidence",
                "Alert a trusted contact or family member",
                "File a police complaint — IPC 354D / 506 may apply",
                "Contact NCW Helpline: 7827170170",
                "Seek legal advice urgently",
            ],
            "suspicious": [
                "Screenshot and save this message as evidence",
                "Monitor for further messages",
                "Avoid engaging with the sender",
                "Consider blocking if behaviour continues",
                "Share with a trusted person",
            ],
            "safe": ["No action required. Stay safe."],
        }.get(label, ["No action required."])

    @staticmethod
    def _support_message(label: str) -> str:
        return {
            "dangerous": (
                "Hey, I want you to know — what you're experiencing is NOT okay, and you are NOT overreacting. "
                "This message shows serious warning signs. Your safety matters most right now. "
                "Please reach out to someone you trust, or call the NCW helpline at 7827170170. You deserve to be safe."
            ),
            "suspicious": (
                "Trust your instincts on this one. If something feels off, it probably is. "
                "You have every right to set boundaries. Save this message just in case, and stay aware. You've got this."
            ),
            "safe": "This message looks safe. Stay aware and take care of yourself. ",
        }.get(label, "Stay safe.")
