import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..permissions import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/device-sensors", tags=["device-sensors"])


class DeviceSensorRow(BaseModel):
    id: UUID
    device_id: UUID
    outlet_id: UUID
    sensor_type: str
    unit: Optional[str] = None
    is_active: bool


@router.get("", response_model=list[DeviceSensorRow])
def list_device_sensors(
    device_id: UUID = Query(..., description="Device UUID"),
    outlet_id: Optional[UUID] = Query(default=None, description="Outlet UUID"),
    x_user_id: Optional[UUID] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    """
    List sensors for a device (optionally filtered by outlet).
    This is used by the app/firmware to discover `sensor_id` values.
    """
    try:
        ws_row = db.execute(
            text("SELECT workspace_id FROM devices WHERE id = :device_id"),
            {"device_id": device_id},
        ).mappings().first()
        if ws_row and x_user_id:
            require_role(db, ws_row["workspace_id"], x_user_id, "VIEWER")

        sql = """
            SELECT id, device_id, outlet_id, sensor_type, unit, is_active
            FROM device_sensors
            WHERE device_id = :device_id
        """
        params: dict[str, object] = {"device_id": device_id}
        if outlet_id is not None:
            sql += " AND outlet_id = :outlet_id"
            params["outlet_id"] = outlet_id
        sql += " ORDER BY outlet_id ASC, sensor_type ASC"

        rows = db.execute(text(sql), params).mappings().all()
        return [
            DeviceSensorRow(
                id=r["id"],
                device_id=r["device_id"],
                outlet_id=r["outlet_id"],
                sensor_type=r["sensor_type"],
                unit=r.get("unit"),
                is_active=r["is_active"],
            )
            for r in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list device sensors")
        raise HTTPException(status_code=500, detail=str(e))

