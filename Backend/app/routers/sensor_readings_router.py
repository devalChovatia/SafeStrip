"""
POST /sensor-readings for water (and other) sensor readings.
Matches Supabase sensor_readings table: id (uuid), device_id (uuid), sensor_type, value, unit, raw, created_at.
"""
import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SensorReading, SensorType
from ..mqtt_publish import publish_dashboard_event

router = APIRouter(prefix="/sensor-readings", tags=["sensor-readings"])
logger = logging.getLogger(__name__)

def _reading_payload(
    *,
    id: Any,
    device_id: Any,
    sensor_type_label: str,
    value: Any,
    unit: Any,
    raw: Any,
    created_at: Any,
) -> dict[str, Any]:
    """JSON shape for one reading; sensor_type is normalized lowercase for the app."""
    st = str(sensor_type_label).lower().strip()
    return {
        "id": str(id),
        "device_id": str(device_id),
        "sensor_type": st,
        "value": float(value),
        "unit": unit,
        "raw": raw,
        "created_at": created_at.isoformat() if created_at else None,
    }


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
    Compares sensor_type case-insensitively (PostgreSQL enum labels may be SMOKE vs smoke).
    """
    try:
        st = sensor_type.value if hasattr(sensor_type, "value") else str(sensor_type)
        row = (
            db.execute(
                text(
                    """
                    SELECT id, device_id, sensor_type::text AS st, value, unit, raw, created_at
                    FROM sensor_readings
                    WHERE device_id = CAST(:did AS uuid)
                      AND lower(sensor_type::text) = lower(:stype)
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ),
                {"did": str(device_id), "stype": st},
            )
            .mappings()
            .first()
        )

        if not row:
            return None

        return _reading_payload(
            id=row["id"],
            device_id=row["device_id"],
            sensor_type_label=row["st"],
            value=row["value"],
            unit=row["unit"],
            raw=row["raw"],
            created_at=row["created_at"],
        )
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

    Uses DISTINCT ON (lower(sensor_type)) so we get the newest row per type even when
    PostgreSQL enum labels differ in case from SQLAlchemy filters (e.g. SMOKE vs smoke).
    """
    try:
        canonical_keys = [st.value for st in SensorType]
        result: dict[str, Optional[dict[str, Any]]] = {k: None for k in canonical_keys}

        rows = (
            db.execute(
                text(
                    """
                    SELECT DISTINCT ON (lower(sensor_type::text))
                        id,
                        device_id,
                        sensor_type::text AS st,
                        value,
                        unit,
                        raw,
                        created_at
                    FROM sensor_readings
                    WHERE device_id = CAST(:did AS uuid)
                    ORDER BY lower(sensor_type::text), created_at DESC
                    """
                ),
                {"did": str(device_id)},
            )
            .mappings()
            .all()
        )

        for row in rows:
            nk = str(row["st"] or "").lower().strip()
            if nk not in result:
                continue
            result[nk] = _reading_payload(
                id=row["id"],
                device_id=row["device_id"],
                sensor_type_label=row["st"],
                value=row["value"],
                unit=row["unit"],
                raw=row["raw"],
                created_at=row["created_at"],
            )

        return {
            "device_id": str(device_id),
            "readings": result,
        }

    except Exception as e:
        logger.exception("Failed to fetch latest sensor readings for all sensor types")
        raise HTTPException(status_code=500, detail=str(e))
