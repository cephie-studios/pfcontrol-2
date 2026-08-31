import { apiFetch } from '../apiFetch.js';
import { apiError } from './error.js';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export interface UserNotification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export async function fetchUnreadUserNotifications(): Promise<{
  notifications: UserNotification[];
}> {
  const res = await apiFetch(`${API_BASE_URL}/api/user-notifications/unread`, {
    credentials: 'include',
  });
  if (!res.ok) await apiError(res, 'Failed to load notifications');
  return res.json();
}

export async function markUserNotificationRead(id: number): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/user-notifications/${id}/read`,
    { method: 'POST', credentials: 'include' }
  );
  if (!res.ok) await apiError(res, 'Failed to dismiss notification');
}

export async function markAllUserNotificationsRead(): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/user-notifications/read-all`,
    { method: 'POST', credentials: 'include' }
  );
  if (!res.ok) await apiError(res, 'Failed to dismiss notifications');
}
