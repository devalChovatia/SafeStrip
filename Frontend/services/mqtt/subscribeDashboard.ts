import { Buffer } from "buffer";
import mqtt, { type MqttClient } from "mqtt";

if (typeof global !== "undefined" && !(global as { Buffer?: unknown }).Buffer) {
	(global as { Buffer: typeof Buffer }).Buffer = Buffer;
}

export type DashboardMqttHandlers = {
	onOutlet?: (msg: { id: string; is_active: boolean; outlet_name?: string }) => void;
	onSensor?: (msg: { sensor_type: string; value?: unknown; raw?: unknown }) => void;
};

/**
 * Subscribe to backend-published dashboard events.
 * Broker must expose MQTT over WebSockets for Expo (e.g. Mosquitto ws://<host>:9001).
 * Backend uses TCP to the same broker; topic: safestrip/device/{deviceId}/dashboard
 */
export function subscribeDeviceDashboard(deviceId: string, handlers: DashboardMqttHandlers): () => void {
	const url = process.env.EXPO_PUBLIC_MQTT_WS_URL?.trim();
	if (!url) {
		return () => {};
	}

	const topic = `safestrip/device/${deviceId}/dashboard`;
	const client: MqttClient = mqtt.connect(url, {
		username: process.env.EXPO_PUBLIC_MQTT_USER || undefined,
		password: process.env.EXPO_PUBLIC_MQTT_PASS || undefined,
		reconnectPeriod: 5000,
		connectTimeout: 15_000,
		clientId: `safestrip-app-${Math.random().toString(16).slice(2, 10)}`,
	});

	client.on("connect", () => {
		client.subscribe(topic, { qos: 1 });
	});

	if (__DEV__) {
		client.on("error", (err) => {
			console.warn("[MQTT] error:", err?.message ?? String(err));
		});
		client.on("close", () => {
			console.warn("[MQTT] connection closed");
		});
	}

	client.on("message", (_t, payload) => {
		try {
			const text = typeof payload === "string" ? payload : payload.toString();
			const msg = JSON.parse(text) as {
				ev?: string;
				id?: string;
				is_active?: boolean;
				outlet_name?: string;
				sensor_type?: string;
				value?: unknown;
				raw?: unknown;
			};
			if (msg.ev === "outlet" && msg.id != null && typeof msg.is_active === "boolean") {
				handlers.onOutlet?.({
					id: msg.id,
					is_active: msg.is_active,
					outlet_name: msg.outlet_name,
				});
			} else if (msg.ev === "sensor" && msg.sensor_type) {
				handlers.onSensor?.({
					sensor_type: msg.sensor_type,
					value: msg.value,
					raw: msg.raw,
				});
			}
		} catch {
			// ignore malformed payloads
		}
	});

	return () => {
		try {
			client.end(true);
		} catch {
			// ignore
		}
	};
}
