import { apiFetch } from "../apiFetch.js";

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export interface AdminDeveloperApplication {
  id: number;
  userId: string;
  username: string;
  whoText: string;
  whyText: string;
  requestedScopes: string[];
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewerNote: string | null;
  approvedScopes: string[] | null;
  createdAt: string;
}

export async function fetchAdminDeveloperApplications(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ applications: AdminDeveloperApplication[]; total: number }> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.status && params.status.length > 0) sp.set("status", params.status);
  const res = await apiFetch(`${API_BASE_URL}/api/admin/developers/applications?${sp.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load applications");
  return res.json();
}

export async function approveDeveloperApplication(
  id: number,
  body?: {
    approvedScopes?: string[];
    note?: string;
    rateLimitPerMinute?: number | null;
  },
): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/api/admin/developers/applications/${id}/approve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Approve failed");
  }
}

export async function rejectDeveloperApplication(id: number, note?: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/api/admin/developers/applications/${id}/reject`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: note ?? "" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Reject failed");
  }
}

export interface AdminScopeCatalogEntry {
  id: string;
  label: string;
  description: string;
}

export async function fetchAdminDeveloperCatalog(): Promise<AdminScopeCatalogEntry[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/admin/developers/catalog`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load scope catalog");
  const data = await res.json();
  return data.scopes as AdminScopeCatalogEntry[];
}

export interface AdminDeveloperSummary {
  userId: string;
  username: string;
  avatar?: string | null;
  status: string;
  approvedScopes: string[];
  keysActive: number;
  keysPending: number;
  keysTotal: number;
  lastApiActivity: string | null;
  updatedAt: string;
  adminNoticeSeq: number;
  noticeDismissedSeq: number;
}

export async function fetchAdminDevelopers(): Promise<{ developers: AdminDeveloperSummary[] }> {
  const res = await apiFetch(`${API_BASE_URL}/api/admin/developers/developers`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load developers");
  return res.json();
}

export interface AdminDeveloperKeyRow {
  id: string;
  name: string;
  prefix: string;
  status: string;
  scopes: string[];
  requestedScopes: string[];
  rateLimitPerMinute: number | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewerNote: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export async function fetchAdminDeveloperKeys(
  userId: string,
): Promise<{ keys: AdminDeveloperKeyRow[] }> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/developers/${encodeURIComponent(userId)}/keys`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Failed to load keys");
  return res.json();
}

export async function approveAdminDeveloperKey(
  userId: string,
  keyId: string,
  body: {
    approvedScopes: string[];
    rateLimitPerMinute?: number | null;
    note?: string;
  },
): Promise<{ secret: string; prefix: string }> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/developers/${encodeURIComponent(userId)}/keys/${encodeURIComponent(keyId)}/approve`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Approve key failed");
  }
  return res.json();
}

export async function rejectAdminDeveloperKey(
  userId: string,
  keyId: string,
  note?: string,
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/developers/${encodeURIComponent(userId)}/keys/${encodeURIComponent(keyId)}/reject`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note ?? "" }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Reject key failed");
  }
}

export async function patchAdminDeveloperKey(
  userId: string,
  keyId: string,
  body: { scopes: string[]; rateLimitPerMinute?: number | null },
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/developers/${encodeURIComponent(userId)}/keys/${encodeURIComponent(keyId)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Update key failed");
  }
}

export async function revokeAdminDeveloperKey(userId: string, keyId: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/developers/${encodeURIComponent(userId)}/keys/${encodeURIComponent(keyId)}/revoke`,
    { method: "POST", credentials: "include" },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Revoke failed");
  }
}

export async function patchAdminDeveloperProfileScopes(
  userId: string,
  approvedScopes: string[],
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/developers/profiles/${encodeURIComponent(userId)}/scopes`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvedScopes }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Update scopes failed");
  }
}

export async function suspendDeveloperProfile(userId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/api/admin/developers/profiles/${userId}/suspend`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Suspend failed");
}

export async function reactivateDeveloperProfile(userId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/api/admin/developers/profiles/${userId}/reactivate`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Reactivate failed");
}

export async function deleteAdminDeveloperAccount(userId: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/admin/developers/profiles/${encodeURIComponent(userId)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Delete failed");
  }
}