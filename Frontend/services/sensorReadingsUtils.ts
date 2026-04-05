import type { SensorReading } from "@/services/api/sensorReadingsApi";

export type SensorTypeKey = "current" | "smoke" | "water" | "humidity" | "temp";

/** Map one MQTT/API sensor payload into outlet fields (device-level sensors). */
export function partialOutletFromSensorPayload(payload: {
	sensor_type: string;
	value?: unknown;
	raw?: unknown;
	unit?: unknown;
}): Partial<DeviceSensorFields> {
	const reading = { value: payload.value, raw: payload.raw, unit: payload.unit };
	switch (payload.sensor_type) {
		case "water":
			return { waterDetected: waterDetectedFromReading(reading) };
		case "smoke":
			return {
				smokeDetected: smokeDetectedFromReading(reading),
				smokeValue: smokeValueFromReading(reading),
				smokeUnit: smokeUnitFromReading(reading),
			};
		case "temp":
			return {
				temperature: temperatureFromReading(reading),
				overheatWarning: overheatFromReading(reading),
			};
		case "current":
			return {
				current: currentValueFromReading(reading),
				currentUnit: currentUnitFromReading(reading),
				currentWarning: overCurrentFromReading(reading),
			};
		default:
			return {};
	}
}

export type DeviceSensorFields = {
	temperature: number | null;
	current: number | null;
	currentUnit: string;
	smokeValue: number | null;
	smokeUnit: string;
	smokeDetected: boolean;
	waterDetected: boolean;
	overheatWarning: boolean;
	currentWarning: boolean;
};

export function deviceSensorFieldsFromReadings(
	readings: Partial<Record<SensorTypeKey, SensorReading | null | undefined>>,
): DeviceSensorFields {
	const water = readings.water ?? null;
	const smoke = readings.smoke ?? null;
	const temp = readings.temp ?? null;
	const cur = readings.current ?? null;
	return {
		waterDetected: water ? waterDetectedFromReading(water) : false,
		smokeDetected: smoke ? smokeDetectedFromReading(smoke) : false,
		smokeValue: smoke ? smokeValueFromReading(smoke) : null,
		smokeUnit: smokeUnitFromReading(smoke),
		temperature: temp ? temperatureFromReading(temp) : null,
		overheatWarning: temp ? overheatFromReading(temp) : false,
		current: cur ? currentValueFromReading(cur) : null,
		currentUnit: currentUnitFromReading(cur),
		currentWarning: cur ? overCurrentFromReading(cur) : false,
	};
}

export function waterDetectedFromReading(reading: { value?: unknown; raw?: unknown }): boolean {
	const raw = reading.raw as { waterDetected?: boolean } | null | undefined;
	if (raw && typeof raw.waterDetected === "boolean") return raw.waterDetected;
	return Number(reading.value ?? 0) > 0;
}

export function smokeDetectedFromReading(reading: { value?: unknown; raw?: unknown }): boolean {
	const raw = reading.raw as { smokeDetected?: boolean } | null | undefined;
	if (raw && typeof raw.smokeDetected === "boolean") return raw.smokeDetected;
	return Number(reading.value ?? 0) > 0;
}

/** Raw ADC / scaled smoke reading (matches backend `value`). */
export function smokeValueFromReading(reading: { value?: unknown; raw?: unknown } | null | undefined): number | null {
	if (reading == null) return null;
	const n = Number(reading.value ?? NaN);
	if (Number.isNaN(n)) return null;
	return n;
}

export function smokeUnitFromReading(
	reading: { value?: unknown; unit?: unknown } | null | undefined,
): string {
	if (reading == null) return "analog";
	const u = reading.unit;
	return typeof u === "string" && u.length > 0 ? u : "analog";
}

export function temperatureFromReading(reading: { value?: unknown; raw?: unknown }): number {
	const raw = reading.raw as { temperatureC?: number } | null | undefined;
	if (raw && typeof raw.temperatureC === "number") return raw.temperatureC;
	return Number(reading.value ?? 0);
}

export function overheatFromReading(reading: { value?: unknown; raw?: unknown }): boolean {
	const raw = reading.raw as { overheatDetected?: boolean } | null | undefined;
	if (raw && typeof raw.overheatDetected === "boolean") return raw.overheatDetected;
	return temperatureFromReading(reading) > 40;
}

export function currentValueFromReading(reading: { value?: unknown; raw?: unknown }): number {
	return Number(reading.value ?? 0);
}

export function currentUnitFromReading(
	reading: { value?: unknown; raw?: unknown; unit?: unknown } | null | undefined,
): string {
	if (!reading) return "A";
	const u = reading.unit;
	return typeof u === "string" && u.length > 0 ? u : "A";
}

export function overCurrentFromReading(reading: { value?: unknown; raw?: unknown }): boolean {
	const raw = reading.raw as { overCurrentDetected?: boolean } | null | undefined;
	if (raw && typeof raw.overCurrentDetected === "boolean") return raw.overCurrentDetected;
	return currentValueFromReading(reading) > 8;
}

