"""
POST /sensor-readings for water (and other) sensor readings.
Matches Supabase sensor_readings table: id (uuid), device_id (uuid), sensor_type, value, unit, raw, created_at.
"""
import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SensorReading, SensorType
from ..mqtt_publish import publish_dashboard_event

router = APIRouter(prefix="/sensor-readings", tags=["sensor-readings"])
logger = logging.getLogger(__name__)


class SensorReadingCreate(BaseModel):
    device_id: UUID
    sensor_type: SensorType
    value: float = Field(..., description="Numeric reading value")
    unit: Optional[str] = None
    raw: Optional[dict[str, Any]] = None

    model_config = ConfigDict(use_enum_values=True)

class SensorReadingBatchCreate(BaseModel):
    readings: list[SensorReadingCreate]

@router.post("", status_code=201)
def create_sensor_reading(payload: SensorReadingCreate, db: Session = Depends(get_db)):
    """Create a water (or other) sensor reading. id and created_at are set by the server."""
    try:
        row = SensorReading(
            device_id=payload.device_id,
            sensor_type=payload.sensor_type,
            value=payload.value,
            unit=payload.unit,
            raw=payload.raw,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        st = row.sensor_type.value if hasattr(row.sensor_type, "value") else row.sensor_type
        device_id_str = str(row.device_id)
        publish_dashboard_event(
            device_id_str,
            {
                "ev": "sensor",
                "device_id": device_id_str,
                "sensor_type": st,
                "value": float(row.value),
                "unit": row.unit,
                "raw": row.raw,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            },
        )
        return {
            "id": str(row.id),
            "device_id": device_id_str,
            "sensor_type": st,
            "value": float(row.value),
            "unit": row.unit,
            "raw": row.raw,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
    except Exception as e:
        logger.exception("Failed to create sensor reading")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/batch", status_code=201)
def create_sensor_readings_batch(
    payload: SensorReadingBatchCreate,
    db: Session = Depends(get_db),
):
    """Create multiple sensor readings in one request."""
    try:
        if not payload.readings:
            raise HTTPException(status_code=400, detail="readings array cannot be empty")

        rows = []

        for reading in payload.readings:
            row = SensorReading(
                device_id=reading.device_id,
                sensor_type=reading.sensor_type,
                value=reading.value,
                unit=reading.unit,
                raw=reading.raw,
            )
            db.add(row)
            rows.append(row)

        db.commit()

        response_items = []

        for row in rows:
            db.refresh(row)

            st = row.sensor_type.value if hasattr(row.sensor_type, "value") else row.sensor_type
            device_id_str = str(row.device_id)

            publish_dashboard_event(
                device_id_str,
                {
                    "ev": "sensor",
                    "device_id": device_id_str,
                    "sensor_type": st,
                    "value": float(row.value),
                    "unit": row.unit,
                    "raw": row.raw,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                },
            )

            response_items.append(
                {
                    "id": str(row.id),
                    "device_id": device_id_str,
                    "sensor_type": st,
                    "value": float(row.value),
                    "unit": row.unit,
                    "raw": row.raw,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
            )

        return {
            "count": len(response_items),
            "readings": response_items,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create sensor readings batch")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/latest")
def get_latest_sensor_reading(
    device_id: UUID = Query(..., description="Device UUID"),
    sensor_type: SensorType = Query(SensorType.WATER),
    db: Session = Depends(get_db),
):
    """
    Return the latest sensor_readings row for a device and sensor_type.
    Used by the demo app to poll the water sensor.
    """
    try:
        row = (
            db.query(SensorReading)
            .filter(
                SensorReading.device_id == device_id,
                SensorReading.sensor_type == sensor_type,
            )
            .order_by(SensorReading.created_at.desc())
            .first()
        )

        if not row:
            return None

        return {
            "id": str(row.id),
            "device_id": str(row.device_id),
            "sensor_type": row.sensor_type.value
            if hasattr(row.sensor_type, "value")
            else row.sensor_type,
            "value": float(row.value),
            "unit": row.unit,
            "raw": row.raw,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
    except Exception as e:
        logger.exception("Failed to fetch latest sensor reading")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/latest-all")
def get_latest_all_sensor_readings(
    device_id: UUID = Query(..., description="Device UUID"),
    db: Session = Depends(get_db),
):
    """
    Return the latest sensor_readings row for each sensor type for a device.
    Used when the dashboard wants all latest sensor values at once.
    """
    try:
        result = {}

        for sensor_type in SensorType:
            row = (
                db.query(SensorReading)
                .filter(
                    SensorReading.device_id == device_id,
                    SensorReading.sensor_type == sensor_type,
                )
                .order_by(SensorReading.created_at.desc())
                .first()
            )

            key = sensor_type.value if hasattr(sensor_type, "value") else str(sensor_type)

            if row is None:
                result[key] = None
            else:
                result[key] = {
                    "id": str(row.id),
                    "device_id": str(row.device_id),
                    "sensor_type": row.sensor_type.value
                    if hasattr(row.sensor_type, "value")
                    else row.sensor_type,
                    "value": float(row.value),
                    "unit": row.unit,
                    "raw": row.raw,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }

        return {
            "device_id": str(device_id),
            "readings": result,
        }

    except Exception as e:
        logger.exception("Failed to fetch latest sensor readings for all sensor types")
        raise HTTPException(status_code=500, detail=str(e))
