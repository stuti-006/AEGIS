"""
FastAPI auth helpers (JWT Bearer).
"""

from __future__ import annotations

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from services.auth_service import User, get_auth_service


bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> User:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = creds.credentials
    auth = get_auth_service()
    try:
        return auth.validate_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

