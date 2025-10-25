const API_BASE_URL = import.meta.env.VITE_SERVER_URL || '';

export interface UpdateModal {
  id: number;
  title: string;
  content: string;
  banner_url?: string | null;
  is_active: boolean;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function fetchActiveUpdateModal(): Promise<UpdateModal | null> {
  const response = await fetch(`${API_BASE_URL}/api/update-modal/active`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch active update modal: ${response.statusText}`);
  }

  return response.json();
}
