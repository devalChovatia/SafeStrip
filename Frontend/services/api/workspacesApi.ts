import apiClient from "./apiClient";

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
	status?: string | null;
	last_seen_at?: string | null;
	created_at?: string | null;
}

export type MemberRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface WorkspaceMember {
	workspace_id: string;
	user_id: string;
	role: MemberRole;
	created_at?: string | null;
}

export interface WorkspaceMemberWithProfile {
	user_id: string;
	role: string;
	display_name?: string | null;
}

export async function fetchWorkspaceMembers(
	workspaceId: string,
): Promise<WorkspaceMemberWithProfile[]> {
	const res = await apiClient.get<WorkspaceMemberWithProfile[]>(
		`/api/workspaces/${workspaceId}/members`,
	);
	return res.data;
}

export async function fetchWorkspaces(userId?: string): Promise<Workspace[]> {
	const res = await apiClient.get<Workspace[]>("/api/workspaces", {
		params: userId ? { member_user_id: userId } : undefined,
	});
	return res.data;
}

export async function createWorkspace(payload: { name: string; created_by?: string | null }): Promise<Workspace> {
	const res = await apiClient.post<Workspace>("/api/workspaces", payload);
	return res.data;
}

export async function fetchDevicesForWorkspace(workspaceId: string): Promise<DeviceStrip[]> {
	const res = await apiClient.get<DeviceStrip[]>(`/api/workspaces/${workspaceId}/devices`);
	return res.data;
}

export async function createDevice(payload: { workspace_id: string; device_name: string }): Promise<DeviceStrip> {
	const res = await apiClient.post<DeviceStrip>("/api/devices", payload);
	return res.data;
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
	await apiClient.delete(`/api/workspaces/${workspaceId}`);
}

export async function addWorkspaceMemberByEmail(
	workspaceId: string,
	email: string,
	role: MemberRole = "MEMBER",
): Promise<WorkspaceMember> {
	const res = await apiClient.post<WorkspaceMember>(`/api/workspaces/${workspaceId}/members/by-email`, { email, role });
	return res.data;
}
