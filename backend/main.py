"""
Main FastAPI application for AEGIS threat detection system.
"""

from contextlib import asynccontextmanager
from datetime import datetime
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR.parent / ".env", override=False)
load_dotenv(BASE_DIR / ".env", override=False)

from routes.analyze import router as analyze_router
from routes.auth import router as auth_router
from services.report_service import REPORTS_DIR
from services.storage_service import StorageService
from utils.logger import setup_logger

logger = setup_logger(__name__)

# Version
VERSION = "1.0.0"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Initialize services
storage_service = StorageService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("=" * 50)
    logger.info("AEGIS Threat Detection System Starting")
    logger.info(f"Version: {VERSION}")
    logger.info(f"Environment: {ENVIRONMENT}")
    logger.info("=" * 50)

    # Pre-load semantic model at startup so first request isn't slow
    try:
        from services.semantic_matcher import get_semantic_matcher
        import asyncio
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, get_semantic_matcher)
        logger.info("Semantic model pre-loaded successfully")
    except Exception as e:
        logger.warning(f"Semantic model pre-load failed (non-fatal): {e}")

    yield

    logger.info("AEGIS shutting down")


# Create FastAPI app
app = FastAPI(
    title="AEGIS - AI Threat Detection API",
    description="Advanced threat detection and classification system",
    version=VERSION,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global error handler
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions."""
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# Include routers
app.include_router(analyze_router)
app.include_router(auth_router)
app.mount("/reports", StaticFiles(directory=REPORTS_DIR), name="reports")


# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        Health status
    """
    return {
        "status": "healthy",
        "version": VERSION,
        "environment": ENVIRONMENT,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# Info endpoint
@app.get("/info")
async def info():
    """
    System information endpoint.
    
    Returns:
        System information
    """
    stats = storage_service.get_statistics()
    
    return {
        "name": "AEGIS",
        "description": "AI-Powered Threat Detection System",
        "version": VERSION,
        "environment": ENVIRONMENT,
        "deployed_at": datetime.utcnow().isoformat() + "Z",
        "statistics": stats,
        "documentation": "/docs"
    }


# Swagger documentation
@app.get("/")
async def root():
    """Root endpoint redirects to documentation."""
    return {
        "message": "Welcome to AEGIS",
        "docs": "/docs",
        "redoc": "/redoc"
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=ENVIRONMENT == "development",
        log_level="info"
    )
