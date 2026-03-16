import apiClient from './apiClient';

export interface DeviceOutlet {
  id: string;
  device_id: string;
  is_active: boolean;
  outlet_name: string;
}

export async function fetchDeviceOutletsForDevice(
  deviceId: string,
): Promise<DeviceOutlet[]> {
  const res = await apiClient.get<DeviceOutlet[]>('/api/device-outlets', {
    params: { device_id: deviceId },
  });
  return res.data;
}

export async function updateDeviceOutletActive(
  outletId: string,
  isActive: boolean,
): Promise<DeviceOutlet> {
  const res = await apiClient.patch<DeviceOutlet>(`/api/device-outlets/${outletId}`, {
    is_active: isActive,
  });
  return res.data;
}

