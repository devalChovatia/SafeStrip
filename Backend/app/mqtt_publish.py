"""
Publish dashboard events to an MQTT broker (TCP).
Set MQTT_ENABLED=true and broker env vars on Render so the app can subscribe over WSS from Expo.

Topic: safestrip/device/{device_id}/dashboard
Payload: JSON with "ev" == "outlet" | "sensor"
"""
from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any

import paho.mqtt.client as mqtt

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_client: mqtt.Client | None = None


def _enabled() -> bool:
    return os.getenv("MQTT_ENABLED", "").lower() in ("1", "true", "yes")


def _get_client() -> mqtt.Client | None:
    global _client
    if not _enabled():
        return None
    with _lock:
        if _client is not None:
            return _client
        host = os.getenv("MQTT_BROKER_HOST", "").strip()
        if not host:
            logger.warning("MQTT_ENABLED but MQTT_BROKER_HOST is empty; skipping MQTT")
            return None
        port = int(os.getenv("MQTT_BROKER_PORT", "1883"))
        client_id = os.getenv("MQTT_CLIENT_ID", "safestrip-api")

        client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=client_id,
        )
        user = os.getenv("MQTT_USERNAME")
        if user is not None:
            client.username_pw_set(user, os.getenv("MQTT_PASSWORD") or "")

        if os.getenv("MQTT_TLS", "").lower() in ("1", "true", "yes"):
            client.tls_set()

        try:
            client.connect_async(host, port, keepalive=60)
            client.loop_start()
        except Exception as e:
            logger.exception("MQTT connect failed: %s", e)
            return None

        _client = client
        return _client


def publish_dashboard_event(device_id: str, payload: dict[str, Any]) -> None:
    if not _enabled():
        return
    client = _get_client()
    if client is None:
        return
    topic = f"safestrip/device/{device_id}/dashboard"
    try:
        client.publish(topic, json.dumps(payload), qos=1)
    except Exception as e:
        logger.warning("MQTT publish failed: %s", e)


def shutdown() -> None:
    global _client
    with _lock:
        if _client is not None:
            try:
                _client.loop_stop()
                _client.disconnect()
            except Exception:
                pass
            _client = None
