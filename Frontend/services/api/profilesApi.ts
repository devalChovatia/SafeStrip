import apiClient from './apiClient';

export async function upsertProfile(accessToken: string, displayName: string): Promise<void> {
  await apiClient.post(
    '/api/profiles',
    { display_name: displayName },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}
