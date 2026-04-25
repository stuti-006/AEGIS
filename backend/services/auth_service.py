"""
Authentication + session service.

- Email + password (bcrypt hash via passlib)
- JWT access tokens + refresh tokens
- Refresh token persistence/revocation in SQLite
"""

from __future__ import annotations

import os
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from services.storage_service import DB_PATH
from utils.logger import setup_logger

logger = setup_logger(__name__)


# NOTE:
# We intentionally use PBKDF2 instead of bcrypt here because the system bcrypt
# backend can be incompatible with passlib and can raise errors even for normal
# passwords during backend self-checks.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
MAX_PASSWORD_CHARS = 128


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _jwt_secret() -> str:
    # IMPORTANT: set JWT_SECRET in production.
    return os.getenv("JWT_SECRET", "dev-insecure-change-me").strip() or "dev-insecure-change-me"


def _jwt_issuer() -> str:
    return os.getenv("JWT_ISSUER", "aegis").strip() or "aegis"


ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))


@dataclass(frozen=True)
class User:
    user_id: str
    email: str


class AuthService:
    def __init__(self) -> None:
        self._init_tables()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_tables(self) -> None:
        try:
            conn = self._conn()
            cur = conn.cursor()

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """
            )

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    jti TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    revoked INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(user_id)
                )
            """
            )

            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)"
            )

            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to init auth tables: {e}", exc_info=True)

    # ---------------------------
    # Passwords
    # ---------------------------
    def _validate_password_size(self, password: str) -> None:
        # Prevent very large passwords (DoS / accidental paste). PBKDF2 supports long
        # inputs, so this is a product constraint, not a crypto limitation.
        if password is None:
            raise ValueError("Password is required")
        if len(password) > MAX_PASSWORD_CHARS:
            raise ValueError(f"Password is too long (max {MAX_PASSWORD_CHARS} characters). Please use a shorter password.")

    def hash_password(self, password: str) -> str:
        self._validate_password_size(password)
        return pwd_context.hash(password)

    def verify_password(self, password: str, password_hash: str) -> bool:
        try:
            self._validate_password_size(password)
            return pwd_context.verify(password, password_hash)
        except Exception:
            # Treat any verification issue as invalid credentials (don't leak details)
            return False

    # ---------------------------
    # Users
    # ---------------------------
    def create_user(self, email: str, password: str) -> User:
        email = (email or "").strip().lower()
        if not email or "@" not in email:
            raise ValueError("Invalid email")
        if not password or len(password) < 8:
            raise ValueError("Password must be at least 8 characters")
        self._validate_password_size(password)

        user_id = f"usr_{secrets.token_hex(8)}"
        password_hash = self.hash_password(password)

        conn = self._conn()
        cur = conn.cursor()
        try:
            cur.execute(
                "INSERT INTO users (user_id, email, password_hash) VALUES (?, ?, ?)",
                (user_id, email, password_hash),
            )
            conn.commit()
            return User(user_id=user_id, email=email)
        except sqlite3.IntegrityError:
            raise ValueError("Email already registered")
        finally:
            conn.close()

    def authenticate(self, email: str, password: str) -> Optional[User]:
        email = (email or "").strip().lower()
        if not email or not password:
            return None

        conn = self._conn()
        cur = conn.cursor()
        try:
            cur.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cur.fetchone()
            if not row:
                return None
            if not self.verify_password(password, row["password_hash"]):
                return None
            return User(user_id=row["user_id"], email=row["email"])
        finally:
            conn.close()

    def get_user(self, user_id: str) -> Optional[User]:
        conn = self._conn()
        cur = conn.cursor()
        try:
            cur.execute("SELECT user_id, email FROM users WHERE user_id = ?", (user_id,))
            row = cur.fetchone()
            if not row:
                return None
            return User(user_id=row["user_id"], email=row["email"])
        finally:
            conn.close()

    # ---------------------------
    # Tokens
    # ---------------------------
    def create_access_token(self, user: User) -> str:
        now = _utcnow()
        payload = {
            "iss": _jwt_issuer(),
            "sub": user.user_id,
            "email": user.email,
            "type": "access",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=ACCESS_TOKEN_MINUTES)).timestamp()),
        }
        return jwt.encode(payload, _jwt_secret(), algorithm="HS256")

    def create_refresh_token(self, user: User) -> tuple[str, str, datetime]:
        """
        Returns: (refresh_token_jwt, jti, expires_at_utc)
        """
        now = _utcnow()
        jti = f"rft_{secrets.token_hex(16)}"
        exp = now + timedelta(days=REFRESH_TOKEN_DAYS)
        payload = {
            "iss": _jwt_issuer(),
            "sub": user.user_id,
            "email": user.email,
            "type": "refresh",
            "jti": jti,
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
        }
        token = jwt.encode(payload, _jwt_secret(), algorithm="HS256")
        return token, jti, exp

    def persist_refresh_token(self, *, jti: str, user_id: str, expires_at: datetime) -> None:
        conn = self._conn()
        cur = conn.cursor()
        try:
            cur.execute(
                "INSERT INTO refresh_tokens (jti, user_id, expires_at, revoked) VALUES (?, ?, ?, 0)",
                (jti, user_id, expires_at.isoformat()),
            )
            conn.commit()
        finally:
            conn.close()

    def revoke_refresh_token(self, jti: str) -> None:
        conn = self._conn()
        cur = conn.cursor()
        try:
            cur.execute("UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?", (jti,))
            conn.commit()
        finally:
            conn.close()

    def validate_access_token(self, token: str) -> User:
        try:
            payload = jwt.decode(
                token,
                _jwt_secret(),
                algorithms=["HS256"],
                issuer=_jwt_issuer(),
                options={"require_exp": True, "require_iat": True},
            )
            if payload.get("type") != "access":
                raise ValueError("Wrong token type")
            user_id = payload.get("sub")
            email = payload.get("email", "")
            if not user_id:
                raise ValueError("Invalid token")
            return User(user_id=user_id, email=email)
        except (JWTError, ValueError) as e:
            raise ValueError("Invalid access token") from e

    def validate_refresh_token(self, token: str) -> tuple[User, str]:
        """
        Returns: (User, jti)
        """
        try:
            payload = jwt.decode(
                token,
                _jwt_secret(),
                algorithms=["HS256"],
                issuer=_jwt_issuer(),
                options={"require_exp": True, "require_iat": True},
            )
            if payload.get("type") != "refresh":
                raise ValueError("Wrong token type")
            user_id = payload.get("sub")
            email = payload.get("email", "")
            jti = payload.get("jti")
            if not user_id or not jti:
                raise ValueError("Invalid token")
        except (JWTError, ValueError) as e:
            raise ValueError("Invalid refresh token") from e

        # Validate against DB (revocation + expiry)
        conn = self._conn()
        cur = conn.cursor()
        try:
            cur.execute("SELECT * FROM refresh_tokens WHERE jti = ?", (jti,))
            row = cur.fetchone()
            if not row:
                raise ValueError("Refresh token not recognized")
            if int(row["revoked"] or 0) == 1:
                raise ValueError("Refresh token revoked")

            # Compare expiry (ISO stored)
            expires_at = datetime.fromisoformat(row["expires_at"])
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at <= _utcnow():
                raise ValueError("Refresh token expired")

            return User(user_id=user_id, email=email), jti
        finally:
            conn.close()


_singleton: Optional[AuthService] = None


def get_auth_service() -> AuthService:
    global _singleton
    if _singleton is None:
        _singleton = AuthService()
    return _singleton
