"""
Authentication routes (email+password + JWT access/refresh).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services.auth_service import get_auth_service
from utils.auth import get_current_user


router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/register")
async def register(payload: RegisterRequest):
    auth = get_auth_service()
    try:
        user = auth.create_user(payload.email, payload.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    access = auth.create_access_token(user)
    refresh, jti, exp = auth.create_refresh_token(user)
    auth.persist_refresh_token(jti=jti, user_id=user.user_id, expires_at=exp)

    return JSONResponse(
        content={
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "user": {"user_id": user.user_id, "email": user.email},
        }
    )


@router.post("/login")
async def login(payload: LoginRequest):
    auth = get_auth_service()
    user = auth.authenticate(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access = auth.create_access_token(user)
    refresh, jti, exp = auth.create_refresh_token(user)
    auth.persist_refresh_token(jti=jti, user_id=user.user_id, expires_at=exp)

    return JSONResponse(
        content={
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "user": {"user_id": user.user_id, "email": user.email},
        }
    )


@router.post("/refresh")
async def refresh(payload: RefreshRequest):
    auth = get_auth_service()
    try:
        user, jti = auth.validate_refresh_token(payload.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    # Rotate refresh token: revoke old, issue new.
    auth.revoke_refresh_token(jti)
    access = auth.create_access_token(user)
    refresh_token, new_jti, exp = auth.create_refresh_token(user)
    auth.persist_refresh_token(jti=new_jti, user_id=user.user_id, expires_at=exp)

    return JSONResponse(
        content={
            "access_token": access,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {"user_id": user.user_id, "email": user.email},
        }
    )


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return JSONResponse(content={"user": {"user_id": user.user_id, "email": user.email}})
