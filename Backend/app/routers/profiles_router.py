import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


class ProfileOut(BaseModel):
    id: UUID
    display_name: Optional[str] = None
    created_at: Optional[str] = None


class ProfileCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=120)


@router.get("/{user_id}", response_model=ProfileOut)
def get_profile(user_id: UUID, db: Session = Depends(get_db)):
    """Fetch a user's profile by their auth user id."""
    try:
        row = db.execute(
            text(
                """
                SELECT user_id, display_name, created_at
                FROM profiles
                WHERE user_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().first()

        if not row:
            raise HTTPException(status_code=404, detail="Profile not found")

        return {
            "id": row["user_id"],
            "display_name": row.get("display_name"),
            "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get profile")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{user_id}", status_code=201, response_model=ProfileOut)
def upsert_profile(
    user_id: UUID,
    payload: ProfileCreate,
    db: Session = Depends(get_db),
):
    """Create or update a user's profile (display_name)."""
    try:
        row = db.execute(
            text(
                """
                INSERT INTO profiles (user_id, display_name)
                VALUES (:user_id, :display_name)
                ON CONFLICT (user_id)
                DO UPDATE SET display_name = EXCLUDED.display_name
                RETURNING user_id, display_name, created_at
                """
            ),
            {"user_id": user_id, "display_name": payload.display_name},
        ).mappings().first()

        db.commit()

        if not row:
            raise HTTPException(status_code=500, detail="Failed to upsert profile")

        return {
            "id": row["user_id"],
            "display_name": row.get("display_name"),
            "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.exception("Failed to upsert profile")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
