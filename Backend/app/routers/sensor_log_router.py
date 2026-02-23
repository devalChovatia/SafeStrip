import logging
from typing import Any

from fastapi import APIRouter, Body

router = APIRouter(tags=["sensor-log"])

logger = logging.getLogger(__name__)


@router.post("/sensor-data/log")
def log_sensor_data(data: Any = Body(...)):
    """POST endpoint that only logs the received data."""
    logger.info("Data received: %s", data)
    return {"status": "ok", "message": "Data logged"}
