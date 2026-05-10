import { apiFetch } from "../apiFetch.js";
import type { DeveloperApiPublicSpec } from "../../types/developerApiSpec";

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export interface DeveloperScopeCatalogEntry {
  id: string;
  label: string;
  description: string;
}

export interface DeveloperApplicationState {
  profile: {
    status: string;
    approvedScopes: string[];
    adminNoticeSeq: number;
    noticeDismissedSeq: number;
    adminNoticeDetail?: string | null;
  } | null;
  latestApplication: {
    id: number;
    status: string;
    whoText: string;
    whyText: string;
    requestedScopes: string[];
    approvedScopes: string[] | null;
    reviewerNote: string | null;
    reviewedAt: string | null;
    createdAt: string;
  } | null;
}

export async function fetchDeveloperApiDocs(): Promise<DeveloperApiPublicSpec> {
  const tryLive = async () => {
    const res = await apiFetch(`${API_BASE_URL}/api/developer/docs`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("docs request failed");
    return res.json() as Promise<DeveloperApiPublicSpec>;
  };

  try {
    return await tryLive();
  } catch {
    const res = await fetch("/developer-api-docs.json", { credentials: "same-origin" });
    if (!res.ok) throw new Error("Failed to load bundled developer-api-docs.json");
    return res.json() as Promise<DeveloperApiPublicSpec>;
  }
}

export async function fetchDeveloperCatalog(): Promise<DeveloperScopeCatalogEntry[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/developer/catalog`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load scope catalog");
  const data = await res.json();
  return data.scopes as DeveloperScopeCatalogEntry[];
}

export async function fetchDeveloperApplication(): Promise<DeveloperApplicationState> {
  const res = await apiFetch(`${API_BASE_URL}/api/developer/application`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load application");
  return res.json();
}

export async function submitDeveloperApplication(input: {
  who: string;
  why: string;
  requestedScopes: string[];
}): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/api/developer/application`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      who: input.who,
      why: input.why,
      requestedScopes: input.requestedScopes,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to submit");
  }
}

export async function submitDeveloperScopeExpansionRequest(input: {
  who: string;
  why: string;
  additionalScopes: string[];
}): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/api/developer/application/scope-expansion`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      who: input.who,
      why: input.why,
      additionalScopes: input.additionalScopes,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to submit");
  }
}

export interface DeveloperKeyRow {
  id: string;
  name: string;
  prefix: string;
  status: string;
  scopes: string[];
  requestedScopes: string[];
  rateLimitPerMinute: number | null;
  reviewedAt: string | null;
  reviewerNote: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export type DeveloperKeysPayload = {
  keys: DeveloperKeyRow[];
  defaultRateLimitPerMinute: number;
};

export async function fetchDeveloperKeys(): Promise<DeveloperKeysPayload> {
  const res = await apiFetch(`${API_BASE_URL}/api/developer/keys`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to list keys");
  const data = (await res.json()) as {
    keys?: DeveloperKeyRow[];
    defaultRateLimitPerMinute?: number;
  };
  const raw = data.defaultRateLimitPerMinute;
  const defaultRateLimitPerMinute =
    typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 120;
  return {
    keys: Array.isArray(data.keys) ? data.keys : [],
    defaultRateLimitPerMinute,
  };
}

export type CreateDeveloperKeyResult =
  | {
      kind: "active";
      id: string;
      name: string;
      prefix: string;
      scopes: string[];
      secret: string;
      createdAt: string;
    }
  | {
      kind: "pending";
      id: string;
      name: string;
      prefix: string;
      status: string;
      requestedScopes: string[];
      message: string;
      createdAt: string;
    };

export async function createDeveloperKey(input: {
  name: string;
  scopes: string[];
}): Promise<CreateDeveloperKeyResult> {
  const res = await apiFetch(`${API_BASE_URL}/api/developer/keys`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to create key");
  }
  const data = (await res.json()) as Record<string, unknown>;
  if (res.status === 202 || data.status === "pending") {
    return {
      kind: "pending",
      id: String(data.id),
      name: String(data.name),
      prefix: String(data.prefix),
      status: String(data.status ?? "pending"),
      requestedScopes: (data.requestedScopes as string[]) ?? [],
      message: String(data.message ?? "Pending admin approval"),
      createdAt: String(data.createdAt),
    };
  }
  return {
    kind: "active",
    id: String(data.id),
    name: String(data.name),
    prefix: String(data.prefix),
    scopes: (data.scopes as string[]) ?? [],
    secret: String(data.secret),
    createdAt: String(data.createdAt),
  };
}

export async function dismissDeveloperAdminNotice(): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/api/developer/notice/dismiss`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to dismiss");
  }
}

export async function deleteDeveloperKey(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/api/developer/keys/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to delete key");
  }
}

export async function revokeDeveloperKey(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/api/developer/keys/${id}/revoke`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to revoke");
  }
}

export async function rotateDeveloperKey(id: string): Promise<{
  id: string;
  secret: string;
  prefix: string;
  scopes: string[];
}> {
  const res = await apiFetch(`${API_BASE_URL}/api/developer/keys/${id}/rotate`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to rotate key");
  }
  return res.json();
}

export interface DeveloperDashboardSummary {
  days?: number;
  hours?: number;
  granularity?: "day" | "hour";
  daily: { date: string; count: number }[];
  byScope: { scope_id: string; count: number }[];
  recent: {
    id: string;
    scopeId: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    createdAt: string;
    clientIp?: string | null;
  }[];
  totalInRange: number;
}

export async function fetchDeveloperDashboardSummary(opts?: {
  days?: number;
  hours?: number;
}): Promise<DeveloperDashboardSummary> {
  let q = "";
  if (opts?.hours != null) {
    q = `?hours=${opts.hours}`;
  } else if (opts?.days != null) {
    q = `?days=${opts.days}`;
  }
  const res = await apiFetch(`${API_BASE_URL}/api/developer/dashboard/summary${q}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}