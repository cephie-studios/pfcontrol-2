const API_BASE_URL = import.meta.env.VITE_SERVER_URL || '';

export interface Tester {
  id: number;
  user_id: string;
  username: string;
  avatar: string | null;
  added_by: string;
  added_by_username: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface TestersResponse {
  testers: Tester[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface TesterSettings {
  tester_gate_enabled: boolean;
}

async function makeTesterRequest(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}/api/admin/testers${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Admin access required');
    }
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchTesters(
  page: number = 1,
  limit: number = 50,
  search: string = ''
): Promise<TestersResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search: search,
  });

  return makeTesterRequest(`?${params}`);
}

export async function addTester(
  userId: string,
  notes: string = ''
): Promise<Tester> {
  return makeTesterRequest('', {
    method: 'POST',
    body: JSON.stringify({ userId, notes }),
  });
}

export async function removeTester(
  userId: string
): Promise<{ message: string; tester: Tester }> {
  return makeTesterRequest(`/${userId}`, {
    method: 'DELETE',
  });
}

export async function updateTesterSettings(
  settings: Partial<TesterSettings>
): Promise<TesterSettings> {
  return makeTesterRequest('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
