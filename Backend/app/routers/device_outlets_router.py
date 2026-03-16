import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/device-outlets", tags=["device-outlets"])


class DeviceOutletRow(BaseModel):
    id: UUID
    device_id: UUID
    is_active: bool
    outlet_name: str


@router.get("", response_model=List[DeviceOutletRow])
def list_device_outlets(
    device_id: UUID = Query(..., description="Device UUID"),
    db: Session = Depends(get_db),
):
    """
    Return all outlets for a given device_id.
    Intended for demo/testing with a fixed device UUID.
    """
    try:
        rows = (
            db.execute(
                text(
                    """
                    SELECT id, device_id, is_active, outlet_name
                    FROM device_outlets
                    WHERE device_id = :device_id
                    ORDER BY outlet_name ASC
                    """
                ),
                {"device_id": device_id},
            )
            .mappings()
            .all()
        )

        return [
            DeviceOutletRow(
                id=row["id"],
                device_id=row["device_id"],
                is_active=row["is_active"],
                outlet_name=row["outlet_name"],
            )
            for row in rows
        ]
    except Exception as e:
        logger.exception("Failed to list device outlets")
        raise HTTPException(status_code=500, detail=str(e))


class DeviceOutletUpdate(BaseModel):
    is_active: bool


@router.patch("/{outlet_id}")
def update_device_outlet(
    outlet_id: UUID = Path(..., description="Outlet UUID"),
    payload: DeviceOutletUpdate | None = None,
    db: Session = Depends(get_db),
):
    """
    Toggle/update an outlet's is_active flag.
    """
    try:
        if payload is None:
            raise HTTPException(status_code=400, detail="Missing body")

        row = (
            db.execute(
                text(
                    """
                    UPDATE device_outlets
                    SET is_active = :is_active
                    WHERE id = :outlet_id
                    RETURNING id, device_id, is_active, outlet_name
                    """
                ),
                {
                    "is_active": payload.is_active,
                    "outlet_id": outlet_id,
                },
            )
            .mappings()
            .first()
        )

        db.commit()

        if not row:
            raise HTTPException(status_code=404, detail="Outlet not found")

        return {
            "id": str(row["id"]),
            "device_id": str(row["device_id"]),
            "is_active": row["is_active"],
            "outlet_name": row["outlet_name"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update device outlet")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

