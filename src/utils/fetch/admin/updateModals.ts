export type { UpdateModal } from '../updateModal';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || '';

async function makeAdminRequest(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}/api/admin${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    if (response.status === 403) throw new Error('Admin access required');
    if (response.status === 401) throw new Error('Authentication required');
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchAllUpdateModals(): Promise<UpdateModal[]> {
  return makeAdminRequest('/update-modals');
}

export async function fetchUpdateModalById(id: number): Promise<UpdateModal> {
  return makeAdminRequest(`/update-modals/${id}`);
}

export async function createUpdateModal(data: {
  title: string;
  content: string;
  banner_url?: string;
}): Promise<UpdateModal> {
  return makeAdminRequest('/update-modals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUpdateModal(
  id: number,
  data: {
    title?: string;
    content?: string;
    banner_url?: string;
  }
): Promise<UpdateModal> {
  return makeAdminRequest(`/update-modals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteUpdateModal(id: number): Promise<void> {
  return makeAdminRequest(`/update-modals/${id}`, {
    method: 'DELETE',
  });
}

export async function publishUpdateModal(id: number): Promise<UpdateModal> {
  return makeAdminRequest(`/update-modals/${id}/publish`, {
    method: 'POST',
  });
}

export async function unpublishUpdateModal(id: number): Promise<UpdateModal> {
  return makeAdminRequest(`/update-modals/${id}/unpublish`, {
    method: 'POST',
  });
}
