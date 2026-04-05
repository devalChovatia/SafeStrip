import apiClient from './apiClient';

export interface SensorReading {
  id: string;
  device_id: string;
  sensor_type: string;
  value: number;
  unit?: string | null;
  raw?: Record<string, any> | null;
  created_at?: string | null;
}

export type LatestAllSensorReadingsResponse = {
  device_id: string;
  readings: Record<
    'current' | 'smoke' | 'water' | 'humidity' | 'temp',
    SensorReading | null
  >;
};

/** Latest row per sensor type for a device (one HTTP round-trip). */
export async function fetchLatestAllSensorReadings(
  deviceId: string
): Promise<LatestAllSensorReadingsResponse> {
  const res = await apiClient.get<LatestAllSensorReadingsResponse>(
    '/sensor-readings/latest-all',
    {
      params: { device_id: deviceId },
    }
  );
  return res.data;
}

export async function fetchLatestWaterReading(
  deviceId: string
): Promise<SensorReading | null> {
  const { readings } = await fetchLatestAllSensorReadings(deviceId);
  return readings.water ?? null;
}

