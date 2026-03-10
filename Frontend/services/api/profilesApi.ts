import apiClient from './apiClient';

export interface Profile {
  id: string;
  display_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const res = await apiClient.get<Profile>(`/api/profiles/${userId}`);
    return res.data;
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'response' in err) {
      const ax = err as { response?: { status?: number } };
      if (ax.response?.status === 404) return null;
    }
    throw err;
  }
}

export async function upsertProfile(
  userId: string,
  displayName: string,
): Promise<Profile> {
  const res = await apiClient.post<Profile>(`/api/profiles/${userId}`, {
    display_name: displayName,
  });
  return res.data;
}
