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

export async function fetchLatestWaterReading(
  deviceId: string
): Promise<SensorReading | null> {
  const res = await apiClient.get<SensorReading | null>('/sensor-readings/latest', {
    params: {
      device_id: deviceId,
      sensor_type: 'water',
    },
  });
  return res.data;
}

