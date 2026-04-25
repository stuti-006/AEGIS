"""
AEGIS MCP Server — exposes threat analysis as MCP tools.

Any MCP-compatible AI assistant (Claude, Cursor, etc.) can call AEGIS
directly to analyze messages, batch-analyze lists, and generate evidence.

Run standalone:
    python mcp_server.py

Or add to your mcp.json:
    {
      "mcpServers": {
        "aegis": {
          "command": "python",
          "args": ["backend/mcp_server.py"],
          "cwd": "."
        }
      }
    }
"""

import json
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from services.ai_engine import AIEngine
from services.report_service import ReportService
from utils.logger import setup_logger

logger = setup_logger(__name__)

# ── Try to import MCP SDK; give a clear error if not installed ──
try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print(
        "MCP SDK not installed. Run: pip install mcp\n"
        "Or: pip install 'mcp[cli]'",
        file=sys.stderr,
    )
    sys.exit(1)

# ── Initialise services ──
ai_engine = AIEngine()
report_service = ReportService()

mcp = FastMCP(
    "AEGIS",
    instructions=(
        "AEGIS is a women's safety threat intelligence system. "
        "Use analyze_message to classify a single message, "
        "batch_analyze to process multiple messages at once, "
        "and generate_evidence_report to create a court-ready PDF."
    ),
)


# ──────────────────────────────────────────────────────────────────────────────
# Tool 1 — Analyze a single message
# ──────────────────────────────────────────────────────────────────────────────
@mcp.tool()
def analyze_message(message: str) -> dict:
    """
    Analyze a single message for threats against women.

    Returns threat level (SAFE / SUSPICIOUS / DANGEROUS), confidence,
    Threat DNA patterns, legal references, and recommended actions.

    Args:
        message: The text message to analyze.
    """
    if not message or not message.strip():
        return {"error": "Message cannot be empty"}

    result = ai_engine.analyze(message.strip())

    # Return a clean summary — not the full 30-field payload
    return {
        "analysis_id":      result.get("analysis_id"),
        "threat_level":     result.get("threat_level", "SAFE"),
        "confidence":       f"{result.get('confidence', 0) * 100:.1f}%",
        "risk_score":       result.get("risk_score", 0),
        "toxicity":         result.get("toxicity", 0),
        "summary":          result.get("reason") or result.get("summary", ""),
        "patterns":         result.get("patterns_detected", []),
        "threat_dna":       [
            {"pattern": d["pattern"], "match": d["match"], "explanation": d["explanation"]}
            for d in result.get("threat_dna", [])
        ],
        "legal_references": result.get("legal_references", []),
        "recommendations":  result.get("recommendations", []),
        "support_message":  result.get("support_message", ""),
        "urgency":          result.get("urgency", "LOW"),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Tool 2 — Batch analyze a list of messages
# ──────────────────────────────────────────────────────────────────────────────
@mcp.tool()
def batch_analyze(messages: list[str]) -> dict:
    """
    Analyze multiple messages at once and return a summary report.

    Useful for NGOs or researchers processing conversation logs.
    Maximum 50 messages per call.

    Args:
        messages: List of text messages to analyze.
    """
    if not messages:
        return {"error": "No messages provided"}

    messages = [m for m in messages if m and m.strip()][:50]

    results = []
    dangerous_count = 0
    suspicious_count = 0

    for msg in messages:
        r = ai_engine.analyze(msg.strip())
        level = r.get("threat_level", "SAFE")
        if level == "DANGEROUS":
            dangerous_count += 1
        elif level == "SUSPICIOUS":
            suspicious_count += 1

        results.append({
            "message_preview": msg[:80] + ("…" if len(msg) > 80 else ""),
            "threat_level":    level,
            "confidence":      f"{r.get('confidence', 0) * 100:.1f}%",
            "patterns":        r.get("patterns_detected", []),
            "analysis_id":     r.get("analysis_id"),
        })

    return {
        "total":     len(results),
        "dangerous": dangerous_count,
        "suspicious": suspicious_count,
        "safe":      len(results) - dangerous_count - suspicious_count,
        "results":   results,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Tool 3 — Generate a court-ready evidence PDF
# ──────────────────────────────────────────────────────────────────────────────
@mcp.tool()
def generate_evidence_report(message: str) -> dict:
    """
    Analyze a message and generate a court-ready PDF evidence report.

    Returns the filename and path of the generated PDF.

    Args:
        message: The threatening message to document.
    """
    if not message or not message.strip():
        return {"error": "Message cannot be empty"}

    result = ai_engine.analyze(message.strip())
    filename = report_service.generate_pdf(result)

    return {
        "analysis_id":  result.get("analysis_id"),
        "threat_level": result.get("threat_level", "SAFE"),
        "pdf_file":     filename,
        "pdf_path":     f"backend/data/reports/{filename}",
        "summary":      result.get("reason") or result.get("summary", ""),
        "legal_refs":   result.get("legal_references", []),
    }


if __name__ == "__main__":
    mcp.run()
