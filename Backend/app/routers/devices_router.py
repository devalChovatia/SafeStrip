import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/devices", tags=["devices"])


class DeviceCreate(BaseModel):
    workspace_id: UUID
    device_name: str = Field(..., min_length=1, max_length=160)
    device_label: Optional[str] = Field(default=None, max_length=160)


@router.get("")
def list_devices(
    workspace_id: Optional[UUID] = Query(default=None),
    db: Session = Depends(get_db),
):
    try:
        if workspace_id:
            rows = db.execute(
                text(
                    """
                    SELECT id, workspace_id, device_name, device_label, status, last_seen_at, created_at
                    FROM devices
                    WHERE workspace_id = :workspace_id
                    ORDER BY created_at DESC
                    """
                ),
                {"workspace_id": workspace_id},
            ).mappings().all()
        else:
            rows = db.execute(
                text(
                    """
                    SELECT id, workspace_id, device_name, device_label, status, last_seen_at, created_at
                    FROM devices
                    ORDER BY created_at DESC
                    """
                )
            ).mappings().all()

        return [
            {
                "id": str(r["id"]),
                "workspace_id": str(r["workspace_id"]),
                "device_name": r["device_name"],
                "device_label": r.get("device_label"),
                "status": r.get("status"),
                "last_seen_at": r["last_seen_at"].isoformat() if r.get("last_seen_at") else None,
                "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
            }
            for r in rows
        ]
    except Exception as e:
        logger.exception("Failed to list devices")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", status_code=201)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db)):
    """
    Creates a device (power strip) under a workspace.
    `created_at` defaults to now() in the DB.
    """
    try:
        row = db.execute(
            text(
                """
                INSERT INTO devices (workspace_id, device_name, device_label)
                VALUES (:workspace_id, :device_name, :device_label)
                RETURNING id, workspace_id, device_name, device_label, status, last_seen_at, created_at
                """
            ),
            {
                "workspace_id": payload.workspace_id,
                "device_name": payload.device_name,
                "device_label": payload.device_label,
            },
        ).mappings().first()

        db.commit()

        if not row:
            raise HTTPException(status_code=500, detail="Device insert failed")

        return {
            "id": str(row["id"]),
            "workspace_id": str(row["workspace_id"]),
            "device_name": row["device_name"],
            "device_label": row.get("device_label"),
            "status": row.get("status"),
            "last_seen_at": row["last_seen_at"].isoformat() if row.get("last_seen_at") else None,
            "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create device")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

