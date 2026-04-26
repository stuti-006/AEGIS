"""
Analysis routes for AEGIS threat detection API.
"""

from datetime import datetime
from typing import Any, Dict, List
from pydantic import BaseModel
import csv
import io
import json

import requests
import os

def send_to_mcp(data):
    try:
        MCP_URL = os.getenv("MCP_URL")
        res = requests.post(f"{MCP_URL}/process", json=data, timeout=8)
        if res.status_code == 200:
            mcp_data = res.json()
            data["mcp_status"] = "stored" in mcp_data.get("actions_taken", [])
        else:
            data["mcp_status"] = False
    except Exception as e:
        logger.error(f"MCP error: {e}")
        data["mcp_status"] = False

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Depends
from fastapi.responses import JSONResponse

from models.schemas import AnalysisRequest, AnalysisResponse
from services.orchestrator import Orchestrator
from services.storage_service import StorageService
from utils.auth import get_current_user
from utils.logger import setup_logger
from utils.rate_limiter import api_limiter

logger = setup_logger(__name__)


class ImageAnalysisRequest(BaseModel):
    """Request for image-based OCR + analysis."""

    image_base64: str
    language: str = "en"
    ocr_text: str = ""


router = APIRouter(prefix="/api", tags=["analysis"])

orchestrator = Orchestrator()
storage_service = StorageService()


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_message(
    request: AnalysisRequest,
    client_request: Request,
    user=Depends(get_current_user),
):
    """
    Analyze a message for threats.

    Args:
        request: AnalysisRequest with message and language

    Returns:
        AnalysisResponse with classification and risk factors
    """

    # Rate limiting
    client_ip = client_request.client.host if client_request.client else "unknown"
    if not api_limiter.is_allowed(client_ip):
        logger.warning(f"Rate limit exceeded for {client_ip}")
        raise HTTPException(status_code=429, detail="Too many requests")

    # Validate input
    if not request.message or len(request.message) < 1:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if len(request.message) > 10000:
        raise HTTPException(
            status_code=400, detail="Message too long (max 10000 chars)"
        )

    try:
        logger.info(f"Analyzing message from {client_ip}: {request.message[:100]}")

        analysis_result = orchestrator.process(
            message=request.message,
            user_id=user.user_id,
            language=request.language,
        )
        analysis_result["user_id"] = user.user_id
        send_to_mcp(analysis_result)

        logger.info(f"Analysis result: {analysis_result}")

        response_data = AnalysisResponse(**analysis_result)
        logger.info(f"Returning response: {response_data}")
        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/analyze/test")
async def analyze_test():
    return JSONResponse(
        content={
            "label": "safe",
            "confidence": 0.95,
            "reason": "No harmful content detected",
            "risk_factors": [],
            "explanation": "This is a test response. The message appears harmless.",
            "risk_score": 5.0,
            "recommendations": ["No action required"],
            "analysis_id": "ana_test_123456",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
    )


@router.post("/analyze/image")
async def analyze_image(
    request: ImageAnalysisRequest,
    client_request: Request,
    user=Depends(get_current_user),
):
    """
    OCR + threat analysis for uploaded screenshots.

    Accepts a base64-encoded image. If OpenAI is available it uses GPT-4o-mini
    vision for high-quality OCR and immediate context-aware extraction.
    Otherwise it falls back to the client-supplied ocr_text field (pre-extracted
    by Tesseract.js in the browser).
    """
    client_ip = client_request.client.host if client_request.client else "unknown"
    if not api_limiter.is_allowed(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests")

    # ── Use client-side Tesseract text or require it when no vision available ──
    extracted_text = request.ocr_text.strip()

    if orchestrator.ai_engine.client:
        try:
            # Clean base64: strip data URI prefix if present
            b64 = request.image_base64
            if "," in b64:
                b64 = b64.split(",", 1)[1]

            vision_response = orchestrator.ai_engine.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    "This is a screenshot of a conversation or message. "
                                    "Extract ALL visible text exactly as it appears, preserving "
                                    "speaker labels, timestamps, and line breaks. "
                                    "Return ONLY the raw extracted text — no commentary."
                                ),
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{b64}",
                                    "detail": "high",
                                },
                            },
                        ],
                    }
                ],
                max_tokens=1000,
                temperature=0,
            )
            extracted_text = vision_response.choices[0].message.content.strip()
            logger.info(f"Vision OCR extracted {len(extracted_text)} chars")
        except Exception as e:
            logger.warning(f"Vision OCR failed ({e}), using client-side text")

    if not extracted_text:
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from image. Please paste the message text manually.",
        )

    # ── Run full Orchestrator pipeline on extracted text ──
    try:
        analysis_result = orchestrator.process(
            message=extracted_text,
            user_id=user.user_id,
            language=request.language,
        )
        analysis_result["user_id"] = user.user_id
        send_to_mcp(analysis_result)
        analysis_result["ocr_text"] = extracted_text

        return JSONResponse(content=analysis_result)
    except Exception as e:
        logger.error(f"Image analysis failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/history")
async def get_history(limit: int = 50, user=Depends(get_current_user)):
    """
    Get recent analysis history.

    Args:
        limit: Number of records to retrieve

    Returns:
        List of recent analyses
    """
    try:
        if limit > 500:
            limit = 500

        results = storage_service.get_recent_analyses(limit=limit, user_id=user.user_id)
        logger.info(f"Retrieved {len(results)} analysis records")

        return JSONResponse(
            content={"status": "success", "count": len(results), "analyses": results}
        )
    except Exception as e:
        logger.error(f"Failed to retrieve history: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve history: {str(e)}"
        )


@router.get("/statistics")
async def get_statistics(user=Depends(get_current_user)):
    """
    Get analysis statistics.

    Returns:
        Analysis statistics
    """
    try:
        stats = storage_service.get_analysis_statistics(user_id=user.user_id)
        logger.info("Retrieved analysis statistics")
        return JSONResponse(content={"status": "success", "statistics": stats})
    except Exception as e:
        logger.error(f"Failed to retrieve statistics: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve statistics: {str(e)}"
        )


@router.post("/generate-pdf")
async def generate_pdf_report(payload: Dict[str, Any], user=Depends(get_current_user)):
    """
    Generate a downloadable PDF evidence report for an analysis payload.
    """
    if not payload:
        raise HTTPException(status_code=400, detail="Analysis payload is required")

    try:
        # Enrich payload with authenticated reporter identity for form-style PDF.
        payload.setdefault("reporter", {})
        payload["reporter"].update({"user_id": user.user_id, "email": user.email})
        payload["user_id"] = user.user_id
        filename = orchestrator.report_service.generate_pdf(payload)
        return JSONResponse(
            content={
        "status": "success",
        "filename": filename
        }
)
    except Exception as exc:
        logger.error(f"PDF generation failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate PDF")


@router.post("/analyze/batch-csv")
async def analyze_batch_csv(
    file: UploadFile = File(...),
    client_request: Request = None,
    user=Depends(get_current_user),
):
    """
    Batch analyze messages from an uploaded CSV file.
    Uses concurrent GPT calls for speed — 70 messages in ~10-15 seconds.
    """
    import asyncio

    client_ip = (
        client_request.client.host if client_request and client_request.client else "unknown"
    )
    if not api_limiter.is_allowed(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests")

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    try:
        raw = await file.read()
        text = raw.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))

        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="CSV has no headers")

        msg_col = next(
            (f for f in reader.fieldnames if f.strip().lower() == "message"), None
        )
        if not msg_col:
            raise HTTPException(
                status_code=400,
                detail=f"CSV must have a 'message' column. Found: {list(reader.fieldnames)}",
            )

        rows = list(reader)[:200]
        if not rows:
            raise HTTPException(status_code=400, detail="CSV has no data rows")

        # ── Fast batch classifier using GPT with a lightweight prompt ──────
        BATCH_SYSTEM = """You are a threat classifier. For each message, respond with ONLY a JSON array.
Each item: {"label": "SAFE|SUSPICIOUS|DANGEROUS", "confidence": 0-100, "risk": 0-100, "summary": "one line", "patterns": ["pattern1"]}
Be accurate. Judge by intent and impact, not just keywords.
SAFE=benign, SUSPICIOUS=concerning/manipulative, DANGEROUS=direct threats/stalking/harassment/coercion."""

        async def classify_batch_gpt(messages_with_idx, semaphore):
            """Classify a small batch of messages in one GPT call."""
            async with semaphore:
                if not orchestrator.ai_engine.client:
                    # Fallback to rules for each
                    results = []
                    for idx, msg in messages_with_idx:
                        r = orchestrator.ai_engine._analyze_with_rules(msg, f"batch_{idx}")
                        results.append((idx, {
                            "label": r.get("threat_level", "SAFE"),
                            "confidence": round(r.get("confidence", 0) * 100, 1),
                            "risk": round(r.get("risk_score", 0), 1),
                            "summary": r.get("reason", ""),
                            "patterns": r.get("patterns_detected", []),
                        }))
                    return results

                numbered = "\n".join(
                    f'{i+1}. "{msg}"' for i, (_, msg) in enumerate(messages_with_idx)
                )
                try:
                    loop = asyncio.get_event_loop()
                    response = await loop.run_in_executor(
                        None,
                        lambda: orchestrator.ai_engine.client.chat.completions.create(
                            model=orchestrator.ai_engine.model,
                            messages=[
                                {"role": "system", "content": BATCH_SYSTEM},
                                {"role": "user", "content": f"Classify these {len(messages_with_idx)} messages:\n{numbered}"},
                            ],
                            temperature=0.1,
                            response_format={"type": "json_object"},
                            timeout=25,
                        )
                    )
                    raw_json = json.loads(response.choices[0].message.content)
                    # GPT may return {"results": [...]} or just [...]
                    items = raw_json if isinstance(raw_json, list) else (
                        raw_json.get("results") or raw_json.get("classifications") or
                        raw_json.get("messages") or list(raw_json.values())[0]
                    )
                    out = []
                    for i, (orig_idx, _) in enumerate(messages_with_idx):
                        item = items[i] if i < len(items) else {}
                        out.append((orig_idx, {
                            "label": str(item.get("label", "SAFE")).upper(),
                            "confidence": float(item.get("confidence", 50)),
                            "risk": float(item.get("risk", 15)),
                            "summary": str(item.get("summary", "")),
                            "patterns": item.get("patterns", []),
                        }))
                    return out
                except Exception as e:
                    logger.warning(f"Batch GPT call failed: {e}, falling back to rules")
                    out = []
                    for orig_idx, msg in messages_with_idx:
                        r = orchestrator.ai_engine._analyze_with_rules(msg, f"batch_{orig_idx}")
                        out.append((orig_idx, {
                            "label": r.get("threat_level", "SAFE"),
                            "confidence": round(r.get("confidence", 0) * 100, 1),
                            "risk": round(r.get("risk_score", 0), 1),
                            "summary": r.get("reason", ""),
                            "patterns": r.get("patterns_detected", []),
                        }))
                    return out

        # Split into batches of 10, run up to 5 concurrently
        BATCH_SIZE = 10
        MAX_CONCURRENT = 5
        semaphore = asyncio.Semaphore(MAX_CONCURRENT)

        valid_rows = [(i, row.get(msg_col, "").strip()) for i, row in enumerate(rows) if row.get(msg_col, "").strip()]
        skipped_indices = {i for i, row in enumerate(rows) if not row.get(msg_col, "").strip()}

        batches = [valid_rows[i:i+BATCH_SIZE] for i in range(0, len(valid_rows), BATCH_SIZE)]
        tasks = [classify_batch_gpt(batch, semaphore) for batch in batches]
        batch_results = await asyncio.gather(*tasks)

        # Flatten results
        classified = {}
        for batch_result in batch_results:
            for orig_idx, data in batch_result:
                classified[orig_idx] = data

        # Build final results list
        results = []
        counts = {"dangerous": 0, "suspicious": 0, "safe": 0}

        for i, row in enumerate(rows):
            msg = row.get(msg_col, "").strip()
            if not msg:
                results.append({"row": i + 2, "message": "", "skipped": True})
                continue

            c = classified.get(i, {"label": "SAFE", "confidence": 50, "risk": 5, "summary": "", "patterns": []})
            level = c["label"].lower()
            if level not in counts:
                counts[level] = 0
            counts[level] += 1

            results.append({
                "row":          i + 2,
                "message":      msg[:120] + ("…" if len(msg) > 120 else ""),
                "threat_level": c["label"],
                "confidence":   round(c["confidence"], 1),
                "risk_score":   round(c["risk"], 1),
                "patterns":     c["patterns"],
                "legal_refs":   [],
                "analysis_id":  f"batch_{i}",
                "summary":      c["summary"],
            })

        return JSONResponse(content={
            "status":  "success",
            "total":   len(results),
            "counts":  counts,
            "results": results,
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch CSV analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch analysis failed: {str(e)}")


class CrisisMessage(BaseModel):
    messages: List[Dict[str, str]]  # [{role: "user"/"assistant", content: "..."}]
    context: Dict[str, Any] = {}   # threat level, risk score etc from analysis


CRISIS_SYSTEM_PROMPT = """You are AEGIS Crisis Support — a compassionate, trauma-informed AI support agent for women facing online threats, harassment, or danger.

A user has just received a DANGEROUS threat classification from the AEGIS system. Your role is to:
1. Immediately acknowledge their feelings and validate their experience
2. Gently ask where they are and if they are physically safe RIGHT NOW
3. Ask what happened — let them tell their story
4. Ask if there is a trusted person nearby (parent, friend, family)
5. Guide them step by step toward safety — call police (100), NCW helpline (7827170170), or a trusted person
6. Never minimize the threat. Never say "it's probably nothing."
7. Keep responses SHORT (2-4 sentences max). This is a crisis — be calm, warm, direct.
8. If they mention physical danger, immediately say: CALL 100 NOW and stay on the line.
9. Remind them: what they experienced is NOT their fault.

Tone: Warm, calm, like a trusted older sister who knows exactly what to do.
Language: Simple, clear. No jargon. If they write in Hindi or another language, respond in that language.

Emergency numbers to reference when needed:
- Police: 100
- Women Helpline: 1091  
- NCW: 7827170170
- Cyber Crime: 1930"""


@router.post("/crisis-chat")
async def crisis_chat(payload: CrisisMessage, user=Depends(get_current_user)):
    """Crisis support chatbot for dangerous threat situations."""
    try:
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()

        from openai import OpenAI

        if api_key and api_key not in ("sk-your-key-here", "YOUR_NEW_KEY_HERE"):
            client = OpenAI(api_key=api_key)
            model = "gpt-4o-mini"
        elif openrouter_key and openrouter_key != "your-openrouter-key-here":
            client = OpenAI(api_key=openrouter_key, base_url="https://openrouter.ai/api/v1")
            model = "openai/gpt-4o-mini"
        else:
            return JSONResponse(content={
                "reply": "I'm here for you. Please call the NCW helpline at 7827170170 or Police at 100 immediately. You are not alone."
            })

        # --- RAG grounding (vetted crisis playbook snippets) ---

        context = payload.context or {}
        user_last = ""
        for m in reversed(payload.messages or []):
            if m.get("role") == "user" and m.get("content"):
                user_last = m["content"]
                break

        snippets = []
        try:
            from services.crisis_rag import get_crisis_rag
            rag = get_crisis_rag()
            snippets = rag.retrieve(user_last, k=4) if user_last else []
        except Exception as e:
            logger.warning(f"Crisis RAG disabled (low-memory deploy): {e}")

        kb_block = ""
        if snippets:
            formatted = []
            for s in snippets:
                formatted.append(
                    f"[{s.get('title', 'Guidance')} — {s.get('source', 'kb')}]\n{s.get('text', '').strip()}"
                )
            kb_block = "\n\nVetted crisis guidance excerpts (use these; do not invent facts or numbers):\n\n" + "\n\n---\n\n".join(
                formatted
            )

        system = CRISIS_SYSTEM_PROMPT + """

Additional rules:
- Ground your advice in the provided "vetted crisis guidance excerpts" when present.
- If you need emergency/helpline numbers, ONLY use numbers present in the excerpts.
- If critical info is missing, ask 1 short clarifying question (but still give immediate safety steps).
- Do NOT mention that you used documents, retrieval, or a knowledge base.
""".rstrip()

        if context:
            system += (
                f"\n\nContext from AEGIS analysis:\n"
                f"- Threat Level: {context.get('threat_level', 'DANGEROUS')}\n"
                f"- Risk Score: {context.get('risk_score', 'High')}\n"
                f"- Detected patterns: {', '.join(context.get('patterns', []))}\n"
            )

        system += kb_block

        messages = [{"role": "system", "content": system}] + payload.messages

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.4,
            max_tokens=200,
        )

        reply = response.choices[0].message.content
        return JSONResponse(content={"reply": reply})

    except Exception as e:
        logger.error(f"Crisis chat error: {e}")
        return JSONResponse(content={
            "reply": "I'm here with you. Please call Police at 100 or NCW at 7827170170 right now. You are safe to reach out."
        })
    
from fastapi.responses import FileResponse
from services.report_service import REPORTS_DIR

@router.get("/download-pdf/{filename}")
async def download_pdf(filename: str):
    file_path = REPORTS_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=filename
    )
