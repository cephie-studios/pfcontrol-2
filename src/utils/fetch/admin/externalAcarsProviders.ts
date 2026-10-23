import { apiError } from '../error.js';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || '';

export type ExternalAcarsProvider = {
  id: string;
  displayName: string;
  apiBaseUrl: string;
  tokenHeader: string;
  handoffUrl: string;
  enabled: boolean;
  isDefault: boolean;
  hasHandoffApiKey: boolean;
};

export type ExternalAcarsProviderInput = Omit<
  ExternalAcarsProvider,
  'hasHandoffApiKey'
> & { handoffApiKey?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) await apiError(response, `HTTP ${response.status}`);
  return response.status === 204 ? (undefined as T) : response.json();
}

export async function fetchExternalAcarsProviders() {
  return request<{ providers: ExternalAcarsProvider[] }>(
    '/api/admin/external-acars-providers'
  );
}

export async function saveExternalAcarsProvider(
  provider: ExternalAcarsProviderInput
) {
  return request<{ provider: ExternalAcarsProvider }>(
    `/api/admin/external-acars-providers/${encodeURIComponent(provider.id)}`,
    { method: 'PUT', body: JSON.stringify(provider) }
  );
}

export async function deleteExternalAcarsProvider(id: string) {
  return request<void>(
    `/api/admin/external-acars-providers/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
}
