"""
mcp_bridge.py
─────────────────────────────────────────────────────────────────────────────
Drop-in bridge: call this after your AI engine returns an analysis result.
Add it to whatever FastAPI endpoint currently calls alert_service / storage.

HOW TO USE
──────────────────
1. Copy this file into your FastAPI project (e.g. services/mcp_bridge.py)
2. In your route handler, replace direct alert/storage calls with:

       from services.mcp_bridge import dispatch_to_mcp
       await dispatch_to_mcp(analysis_result)

   or the sync variant:
       from services.mcp_bridge import dispatch_to_mcp_sync
       dispatch_to_mcp_sync(analysis_result)

3. Remove (or comment out) the old AlertService / StorageService calls.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import asyncio
import httpx
import logging
from typing import Dict

logger = logging.getLogger(__name__)

MCP_URL = os.getenv("MCP_SERVER_URL", "http://localhost:3001")
MCP_TIMEOUT = float(os.getenv("MCP_TIMEOUT_SECONDS", "5"))


async def dispatch_to_mcp(analysis_result: Dict) -> Dict:
    """
    Async — fire-and-forget friendly.
    Sends the FastAPI analysis result to the MCP server for orchestration.

    Returns the MCP response dict, or an error dict on failure.
    """
    url = f"{MCP_URL}/process"
    try:
        async with httpx.AsyncClient(timeout=MCP_TIMEOUT) as client:
            response = await client.post(url, json=analysis_result)
            response.raise_for_status()
            result = response.json()
            logger.info(
                "MCP dispatch success",
                extra={
                    "analysis_id": analysis_result.get("analysis_id"),
                    "severity": result.get("severity"),
                    "actions_taken": result.get("actions_taken"),
                },
            )
            return result
    except httpx.TimeoutException:
        logger.error("MCP dispatch timed out", extra={"url": url})
        return {"error": "MCP timeout", "status": "failed"}
    except Exception as exc:
        logger.error(f"MCP dispatch error: {exc}")
        return {"error": str(exc), "status": "failed"}


def dispatch_to_mcp_sync(analysis_result: Dict) -> Dict:
    """
    Sync wrapper — use in non-async FastAPI endpoints or background tasks.
    """
    try:
        return asyncio.get_event_loop().run_until_complete(
            dispatch_to_mcp(analysis_result)
        )
    except RuntimeError:
        # If no event loop exists (some environments), create one
        return asyncio.run(dispatch_to_mcp(analysis_result))


# ─────────────────────────────────────────────────────────────────────────────
# EXAMPLE — how to wire into your existing FastAPI route
# ─────────────────────────────────────────────────────────────────────────────
#
# BEFORE (current code):
# ──────────────────────
#   @app.post("/analyze")
#   async def analyze(request: AnalyzeRequest):
#       result = await ai_engine.analyze(request.message)
#       alert_service.send_alert(result)        # ← remove this
#       storage_service.store(result)           # ← remove this
#       return result
#
# AFTER (with MCP bridge):
# ─────────────────────────
#   from services.mcp_bridge import dispatch_to_mcp
#
#   @app.post("/analyze")
#   async def analyze(request: AnalyzeRequest):
#       result = await ai_engine.analyze(request.message)
#       asyncio.create_task(dispatch_to_mcp(result))  # non-blocking
#       return result
#
# Using create_task() means the MCP call is fire-and-forget —
# the API returns instantly to the caller while MCP handles side effects.
# ─────────────────────────────────────────────────────────────────────────────
