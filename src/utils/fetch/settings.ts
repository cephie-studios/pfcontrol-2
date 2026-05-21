import { apiFetch } from '../apiFetch.js';
import { clientApiUrl } from '../clientApiBase.js';
import type { Settings } from '../../types/settings';

export async function fetchUserSettings(): Promise<Settings> {
  const res = await apiFetch(clientApiUrl('/api/auth/me'), {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch settings');
  const user = await res.json();
  return user.settings;
}

export async function updateUserSettings(
  settings: Partial<Settings>
): Promise<void> {
  const res = await apiFetch(clientApiUrl('/api/auth/me'), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  if (!res.ok) throw new Error('Failed to update settings');
}