import { apiFetch } from '../../apiFetch.js';
import { apiError } from '../error.js';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export type ClaimReportStatus = 'open' | 'resolved' | 'dismissed';

export interface AdminClaimReport {
  id: string;
  sessionId: string;
  keyId: string;
  keyName: string | null;
  keyPrefix: string | null;
  keyRevoked: boolean;
  developerUserId: string;
  developerUsername: string | null;
  requesterName: string;
  attempts24h: number;
  keyReportCount: number;
  reporterId: string;
  reporterUsername: string | null;
  reporterAvatar: string | null;
  status: ClaimReportStatus;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export async function fetchAdminClaimReports(params: {
  status: ClaimReportStatus | 'all';
  page: number;
  limit: number;
  search?: string;
}): Promise<{
  reports: AdminClaimReport[];
  openCount: number;
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const sp = new URLSearchParams({
    status: params.status,
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search) sp.set('search', params.search);
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/session-claim-reports?${sp.toString()}`,
    { credentials: 'include' }
  );
  if (!res.ok) await apiError(res, 'Failed to load reports');
  return res.json();
}

export async function updateAdminClaimReport(
  id: string,
  status: ClaimReportStatus
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/session-claim-reports/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }
  );
  if (!res.ok) await apiError(res, 'Failed to update report');
}
