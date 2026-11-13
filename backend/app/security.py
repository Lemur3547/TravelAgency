import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from pwdlib import PasswordHash


logger = logging.getLogger(__name__)
_configured_secret = os.getenv("AUTH_SECRET_KEY")
if _configured_secret:
    AUTH_SECRET_KEY = _configured_secret
    if len(AUTH_SECRET_KEY.encode("utf-8")) < 32:
        raise ValueError("AUTH_SECRET_KEY must contain at least 32 bytes")
else:
    AUTH_SECRET_KEY = secrets.token_urlsafe(48)
    logger.warning(
        "AUTH_SECRET_KEY is not configured; authentication tokens will be invalidated "
        "when the API process restarts"
    )

ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "7"))
if ACCESS_TOKEN_MINUTES < 1 or REFRESH_TOKEN_DAYS < 1:
    raise ValueError("Authentication token lifetimes must be positive")
TOKEN_ISSUER = "travel-agency-api"
PASSWORD_HASHER = PasswordHash.recommended()
DUMMY_PASSWORD_HASH = PASSWORD_HASHER.hash(secrets.token_urlsafe(32))


def hash_password(password: str) -> str:
    return PASSWORD_HASHER.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        PASSWORD_HASHER.verify(password, DUMMY_PASSWORD_HASH)
        return False
    return PASSWORD_HASHER.verify(password, password_hash)


def create_token(
    employee_id: int,
    token_type: str,
    token_id: str,
    expires_at: datetime,
) -> str:
    return jwt.encode(
        {
            "sub": str(employee_id),
            "type": token_type,
            "jti": token_id,
            "iat": datetime.now(timezone.utc),
            "exp": expires_at,
            "iss": TOKEN_ISSUER,
        },
        AUTH_SECRET_KEY,
        algorithm="HS256",
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        AUTH_SECRET_KEY,
        algorithms=["HS256"],
        issuer=TOKEN_ISSUER,
        options={"require": ["sub", "type", "jti", "exp", "iat", "iss"]},
    )


def access_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS)


def create_token_id() -> str:
    return secrets.token_urlsafe(32)


def cookie_settings() -> tuple[bool, str]:
    secure = os.getenv("AUTH_COOKIE_SECURE", "false").strip().lower() in {
        "1",
        "true",
        "yes",
    }
    same_site = os.getenv("AUTH_COOKIE_SAMESITE", "lax").strip().lower()
    if same_site not in {"lax", "strict", "none"}:
        raise ValueError("AUTH_COOKIE_SAMESITE must be lax, strict, or none")
    if same_site == "none" and not secure:
        raise ValueError("AUTH_COOKIE_SECURE must be enabled when SameSite is none")
    return secure, same_site
