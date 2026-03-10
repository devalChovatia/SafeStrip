import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..permissions import require_role
from .. import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/devices", tags=["devices"])


class DeviceCreate(BaseModel):
    workspace_id: UUID
    device_name: str = Field(..., min_length=1, max_length=160)


@router.get("")
def list_devices(
    workspace_id: Optional[UUID] = Query(default=None),
    x_user_id: Optional[UUID] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    if workspace_id and x_user_id:
        require_role(db, workspace_id, x_user_id, "VIEWER")
    try:
        query = db.query(models.WorkspaceDevice)
        if workspace_id:
            query = query.filter(models.WorkspaceDevice.workspace_id == workspace_id)
        devices = query.order_by(models.WorkspaceDevice.created_at.desc()).all()

        return [
            {
                "id": str(d.id),
                "workspace_id": str(d.workspace_id),
                "device_name": d.device_name,
                "status": d.status,
                "last_seen_at": d.last_seen_at.isoformat() if d.last_seen_at else None,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in devices
        ]
    except Exception as e:
        logger.exception("Failed to list devices")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", status_code=201)
def create_device(
    payload: DeviceCreate,
    x_user_id: Optional[UUID] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """
    Creates a device (power strip) under a workspace.
    Requires OWNER or ADMIN in the workspace.
    """
    require_role(db, payload.workspace_id, x_user_id, "ADMIN")
    try:
        device = models.WorkspaceDevice(
            workspace_id=payload.workspace_id,
            device_name=payload.device_name,
        )
        db.add(device)
        db.commit()
        db.refresh(device)

        return {
            "id": str(device.id),
            "workspace_id": str(device.workspace_id),
            "device_name": device.device_name,
            "status": device.status,
            "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
            "created_at": device.created_at.isoformat() if device.created_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create device")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

