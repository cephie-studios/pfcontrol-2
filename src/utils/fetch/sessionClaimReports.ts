import { apiFetch } from '../apiFetch.js';
import { apiError } from './error.js';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export async function reportSessionClaimRequest(input: {
  sessionId: string;
  accessId: string;
  requestId: string;
}): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/api/session-claim-reports`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) await apiError(res, 'Failed to send report');
}
