import apiClient from "./apiClient";

export type DeviceSensor = {
  id: string;
  device_id: string;
  outlet_id: string;
  sensor_type: string;
  unit?: string | null;
  is_active: boolean;
};

export async function fetchDeviceSensorsForDevice(deviceId: string): Promise<DeviceSensor[]> {
  const res = await apiClient.get<DeviceSensor[]>("/api/device-sensors", {
    params: { device_id: deviceId },
  });
  return res.data;
}

