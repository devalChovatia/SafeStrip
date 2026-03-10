import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models

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
        profile = (
            db.query(models.Profile)
            .filter(models.Profile.user_id == user_id)
            .one_or_none()
        )

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        return {
            "id": profile.user_id,
            "display_name": profile.display_name,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
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
        profile = (
            db.query(models.Profile)
            .filter(models.Profile.user_id == user_id)
            .one_or_none()
        )
        if profile is None:
            profile = models.Profile(user_id=user_id, display_name=payload.display_name)
            db.add(profile)
        else:
            profile.display_name = payload.display_name

        db.commit()
        db.refresh(profile)

        return {
            "id": profile.user_id,
            "display_name": profile.display_name,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.exception("Failed to upsert profile")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
