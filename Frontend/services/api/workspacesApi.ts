import apiClient from './apiClient';

export interface Workspace {
  id: string;
  name: string;
  created_by?: string | null;
  created_at?: string | null;
}

export interface DeviceStrip {
  id: string;
  workspace_id: string;
  device_name: string;
  device_label?: string | null;
  status?: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await apiClient.get<Workspace[]>('/api/workspaces');
  return res.data;
}

export async function createWorkspace(payload: { name: string; created_by?: string | null }): Promise<Workspace> {
  const res = await apiClient.post<Workspace>('/api/workspaces', payload);
  return res.data;
}

export async function fetchDevicesForWorkspace(workspaceId: string): Promise<DeviceStrip[]> {
  const res = await apiClient.get<DeviceStrip[]>(`/api/workspaces/${workspaceId}/devices`);
  return res.data;
}

export async function createDevice(payload: {
  workspace_id: string;
  device_name: string;
  device_label?: string | null;
}): Promise<DeviceStrip> {
  const res = await apiClient.post<DeviceStrip>('/api/devices', payload);
  return res.data;
}

