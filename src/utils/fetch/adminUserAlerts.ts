import { apiFetch } from '../apiFetch.js';
import { apiError } from './error.js';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export interface AdminUserAlert {
  id: number;
  user_id: string;
  username: string;
  avatar: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export async function fetchAdminUserAlerts(): Promise<{
  alerts: AdminUserAlert[];
}> {
  const res = await apiFetch(`${API_BASE_URL}/api/admin/user-alerts`, {
    credentials: 'include',
  });
  if (!res.ok) await apiError(res, 'Failed to load alerts');
  return res.json();
}

export async function sendAdminUserAlert(body: {
  username?: string;
  userId?: string;
  type?: string;
  title: string;
  message: string;
}): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/api/admin/user-alerts`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await apiError(res, 'Failed to send alert');
}
