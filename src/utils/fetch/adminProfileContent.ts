import { apiFetch } from '../apiFetch.js';
import { apiError } from './error.js';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export interface AdminProfileContentUser {
  userId: string;
  username: string;
  avatar: string | null;
  bio: string;
  bioAutomodFlagged: boolean;
  bioAutomodReason: string | null;
}

export async function fetchAdminProfileContent(): Promise<{
  users: AdminProfileContentUser[];
}> {
  const res = await apiFetch(`${API_BASE_URL}/api/admin/profile-content`, {
    credentials: 'include',
  });
  if (!res.ok) await apiError(res, 'Failed to load profile content');
  return res.json();
}

export async function adminClearUserBio(userId: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/profile-content/${encodeURIComponent(userId)}/clear-bio`,
    { method: 'POST', credentials: 'include' }
  );
  if (!res.ok) await apiError(res, 'Failed to clear bio');
}
