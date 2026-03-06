import json
import logging
import os

import jwt
from jwt.algorithms import ECAlgorithm
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/profiles", tags=["profiles"])
security = HTTPBearer(auto_error=False)


class ProfileUpsert(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=120)


# Cache the public key so we don't rebuild it on every request
_public_key_cache = None


def _get_public_key():
    """Load and cache the ES256 public key from SUPABASE_JWT_JWK env var."""
    global _public_key_cache
    if _public_key_cache is not None:
        return _public_key_cache

    jwk_str = os.getenv("SUPABASE_JWT_JWK")
    if not jwk_str:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_JWK not configured",
        )
    try:
        jwk = json.loads(jwk_str)
        _public_key_cache = ECAlgorithm.from_jwk(jwk)
        return _public_key_cache
    except Exception as e:
        logger.exception("Failed to parse JWK")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid JWK: {e}",
        )


def get_user_id_from_token(cred: HTTPAuthorizationCredentials | None = Depends(security)) -> str:
    """Verify Supabase JWT (ES256) and return user_id (sub claim)."""
    if not cred:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")

    public_key = _get_public_key()

    try:
        payload = jwt.decode(
            cred.credentials,
            public_key,
            audience="authenticated",
            algorithms=["ES256"],
            leeway=60,  # Allow 60 seconds of clock skew
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return user_id
    except jwt.PyJWTError as e:
        logger.warning("JWT verification failed: %s", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


@router.post("", status_code=201)
def upsert_profile(
    payload: ProfileUpsert,
    user_id: str = Depends(get_user_id_from_token),
    db: Session = Depends(get_db),
):
    """
    Upsert profile for the authenticated user.
    Requires Authorization: Bearer <supabase_access_token>.
    """
    try:
        db.execute(
            text(
                """
                INSERT INTO profiles (user_id, display_name)
                VALUES (:user_id, :display_name)
                ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name
                """
            ),
            {"user_id": user_id, "display_name": payload.display_name.strip()},
        )
        db.commit()
        return {"ok": True}
    except Exception as e:
        logger.exception("Failed to upsert profile")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
