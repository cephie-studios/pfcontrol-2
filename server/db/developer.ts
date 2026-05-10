import { mainDb } from "./connection.js";
import { sql } from "kysely";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

export async function getDeveloperProfile(userId: string) {
  return mainDb
    .selectFrom("developer_profiles")
    .selectAll()
    .where("user_id", "=", userId)
    .executeTakeFirst();
}

export async function getLatestDeveloperApplication(userId: string) {
  return mainDb
    .selectFrom("developer_applications")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .executeTakeFirst();
}

export async function createDeveloperApplication(input: {
  userId: string;
  whoText: string;
  whyText: string;
  requestedScopes: string[];
}) {
  return mainDb
    .insertInto("developer_applications")
    .values({
      id: sql`DEFAULT`,
      user_id: input.userId,
      who_text: input.whoText,
      why_text: input.whyText,
      requested_scopes: sql`CAST(${JSON.stringify(input.requestedScopes)} AS jsonb)`,
      status: "pending",
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirst();
}

export async function updateApplicationReview(input: {
  applicationId: number;
  status: "approved" | "rejected";
  reviewedBy: string;
  reviewerNote: string | null;
  approvedScopes: string[] | null;
}) {
  return mainDb
    .updateTable("developer_applications")
    .set({
      status: input.status,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date(),
      reviewer_note: input.reviewerNote,
      approved_scopes:
        input.approvedScopes != null
          ? sql`CAST(${JSON.stringify(input.approvedScopes)} AS jsonb)`
          : null,
      updated_at: new Date(),
    })
    .where("id", "=", input.applicationId)
    .returningAll()
    .executeTakeFirst();
}

export async function upsertDeveloperProfile(input: {
  userId: string;
  approvedScopes: string[];
  status?: "active" | "suspended";
  defaultRateLimitPerMinute?: number | null;
}) {
  const status = input.status ?? "active";
  const insertRpm =
    input.defaultRateLimitPerMinute !== undefined ? input.defaultRateLimitPerMinute : null;

  const updatePatch = {
    approved_scopes: sql`CAST(${JSON.stringify(input.approvedScopes)} AS jsonb)`,
    status,
    updated_at: new Date(),
    ...(input.defaultRateLimitPerMinute !== undefined
      ? { default_rate_limit_per_minute: input.defaultRateLimitPerMinute }
      : {}),
  };

  return mainDb
    .insertInto("developer_profiles")
    .values({
      user_id: input.userId,
      approved_scopes: sql`CAST(${JSON.stringify(input.approvedScopes)} AS jsonb)`,
      status,
      admin_notice_seq: 0,
      notice_dismissed_seq: 0,
      default_rate_limit_per_minute: insertRpm,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflict((oc) => oc.column("user_id").doUpdateSet(updatePatch))
    .returningAll()
    .executeTakeFirst();
}

const ADMIN_NOTICE_DETAIL_MAX = 2000;

export async function bumpDeveloperAdminNoticeSeq(userId: string, detail: string): Promise<void> {
  const trimmed = detail.trim();
  const clipped =
    trimmed.length > ADMIN_NOTICE_DETAIL_MAX
      ? `${trimmed.slice(0, ADMIN_NOTICE_DETAIL_MAX - 1)}…`
      : trimmed;
  const text = clipped.length > 0 ? clipped : "An administrator updated your developer settings.";
  await sql`
    UPDATE developer_profiles
    SET
      admin_notice_seq = admin_notice_seq + 1,
      admin_notice_detail = ${text},
      updated_at = now()
    WHERE user_id = ${userId}
  `.execute(mainDb);
}

export async function dismissDeveloperAdminNotice(userId: string) {
  await sql`
    UPDATE developer_profiles
    SET notice_dismissed_seq = admin_notice_seq, updated_at = now()
    WHERE user_id = ${userId}
  `.execute(mainDb);
}

export async function updateDeveloperProfileApprovedScopes(
  userId: string,
  approvedScopes: string[],
) {
  return mainDb
    .updateTable("developer_profiles")
    .set({
      approved_scopes: sql`CAST(${JSON.stringify(approvedScopes)} AS jsonb)`,
      updated_at: new Date(),
    })
    .where("user_id", "=", userId)
    .returningAll()
    .executeTakeFirst();
}

export async function setDeveloperProfileStatus(userId: string, status: "active" | "suspended") {
  return mainDb
    .updateTable("developer_profiles")
    .set({ status, updated_at: new Date() })
    .where("user_id", "=", userId)
    .returningAll()
    .executeTakeFirst();
}

export async function updateDeveloperNotificationEmail(userId: string, email: string | null) {
  return mainDb
    .updateTable("developer_profiles")
    .set({
      notification_email: email,
      updated_at: new Date(),
    })
    .where("user_id", "=", userId)
    .returningAll()
    .executeTakeFirst();
}

export async function listDeveloperApplications(filters: {
  status?: string;
  page: number;
  limit: number;
}) {
  const offset = (filters.page - 1) * filters.limit;
  let q = mainDb.selectFrom("developer_applications").selectAll().orderBy("created_at", "desc");
  if (filters.status) {
    q = q.where("status", "=", filters.status);
  }
  const rows = await q.limit(filters.limit).offset(offset).execute();
  let countQ = mainDb
    .selectFrom("developer_applications")
    .select(sql<number>`count(*)::int`.as("c"));
  if (filters.status) {
    countQ = countQ.where("status", "=", filters.status);
  }
  const countRow = await countQ.executeTakeFirst();
  return { applications: rows, total: Number(countRow?.c ?? 0) };
}

export async function getDeveloperApplicationById(id: number) {
  return mainDb
    .selectFrom("developer_applications")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function listDeveloperKeysForUser(userId: string) {
  return mainDb
    .selectFrom("developer_api_keys")
    .select([
      "id",
      "user_id",
      "name",
      "prefix",
      "scopes",
      "status",
      "requested_scopes",
      "rate_limit_per_minute",
      "reviewed_at",
      "reviewer_note",
      "created_at",
      "last_used_at",
      "revoked_at",
    ])
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .execute();
}

export async function listDeveloperApiKeysForAdmin(userId: string) {
  return mainDb
    .selectFrom("developer_api_keys")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .execute();
}

export async function getDeveloperApiKeyForUser(keyId: string, userId: string) {
  return mainDb
    .selectFrom("developer_api_keys")
    .selectAll()
    .where("id", "=", keyId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
}

export async function createDeveloperApiKey(input: {
  userId: string;
  name: string;
  prefix: string;
  secretHash: string;
  scopes: string[];
  rateLimitPerMinute?: number | null;
}) {
  return mainDb
    .insertInto("developer_api_keys")
    .values({
      user_id: input.userId,
      name: input.name,
      prefix: input.prefix,
      secret_hash: input.secretHash,
      scopes: sql`CAST(${JSON.stringify(input.scopes)} AS jsonb)`,
      status: "active",
      requested_scopes: null,
      rate_limit_per_minute: input.rateLimitPerMinute ?? null,
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirst();
}

export async function insertPendingDeveloperApiKey(input: {
  userId: string;
  name: string;
  prefix: string;
  requestedScopes: string[];
}) {
  return mainDb
    .insertInto("developer_api_keys")
    .values({
      user_id: input.userId,
      name: input.name,
      prefix: input.prefix,
      secret_hash: null,
      scopes: sql`'[]'::jsonb`,
      status: "pending",
      requested_scopes: sql`CAST(${JSON.stringify(input.requestedScopes)} AS jsonb)`,
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirst();
}

export async function approvePendingDeveloperApiKey(input: {
  keyId: string;
  userId: string;
  approvedScopes: string[];
  prefix: string;
  secretHash: string;
  rateLimitPerMinute: number | null;
  reviewedBy: string;
  reviewerNote: string | null;
}) {
  return mainDb
    .updateTable("developer_api_keys")
    .set({
      status: "active",
      scopes: sql`CAST(${JSON.stringify(input.approvedScopes)} AS jsonb)`,
      requested_scopes: null,
      prefix: input.prefix,
      secret_hash: input.secretHash,
      rate_limit_per_minute: input.rateLimitPerMinute,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date(),
      reviewer_note: input.reviewerNote,
    })
    .where("id", "=", input.keyId)
    .where("user_id", "=", input.userId)
    .where("status", "=", "pending")
    .where("revoked_at", "is", null)
    .returningAll()
    .executeTakeFirst();
}

export async function rejectPendingDeveloperApiKey(input: {
  keyId: string;
  userId: string;
  reviewedBy: string;
  reviewerNote: string | null;
}) {
  return mainDb
    .updateTable("developer_api_keys")
    .set({
      status: "rejected",
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date(),
      reviewer_note: input.reviewerNote,
    })
    .where("id", "=", input.keyId)
    .where("user_id", "=", input.userId)
    .where("status", "=", "pending")
    .where("revoked_at", "is", null)
    .returningAll()
    .executeTakeFirst();
}

export async function updateDeveloperApiKeyScopesAndRate(input: {
  keyId: string;
  userId: string;
  scopes: string[];
  rateLimitPerMinute: number | null;
}) {
  return mainDb
    .updateTable("developer_api_keys")
    .set({
      scopes: sql`CAST(${JSON.stringify(input.scopes)} AS jsonb)`,
      rate_limit_per_minute: input.rateLimitPerMinute,
    })
    .where("id", "=", input.keyId)
    .where("user_id", "=", input.userId)
    .where("status", "=", "active")
    .where("revoked_at", "is", null)
    .returningAll()
    .executeTakeFirst();
}

export async function revokeDeveloperApiKey(keyId: string, userId: string) {
  return mainDb
    .updateTable("developer_api_keys")
    .set({ revoked_at: new Date() })
    .where("id", "=", keyId)
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null)
    .returningAll()
    .executeTakeFirst();
}

export async function deleteRevokedDeveloperApiKey(keyId: string, userId: string) {
  return mainDb
    .deleteFrom("developer_api_keys")
    .where("id", "=", keyId)
    .where("user_id", "=", userId)
    .where("revoked_at", "is not", null)
    .returningAll()
    .executeTakeFirst();
}

export async function rotateDeveloperApiKey(input: {
  keyId: string;
  userId: string;
  prefix: string;
  secretHash: string;
}) {
  return mainDb
    .updateTable("developer_api_keys")
    .set({
      prefix: input.prefix,
      secret_hash: input.secretHash,
    })
    .where("id", "=", input.keyId)
    .where("user_id", "=", input.userId)
    .where("status", "=", "active")
    .where("secret_hash", "is not", null)
    .where("revoked_at", "is", null)
    .returningAll()
    .executeTakeFirst();
}

export async function touchDeveloperApiKeyLastUsed(keyId: string) {
  await mainDb
    .updateTable("developer_api_keys")
    .set({ last_used_at: new Date() })
    .where("id", "=", keyId)
    .execute();
}

export type DeveloperKeyRow = {
  id: string;
  user_id: string;
  name: string;
  prefix: string;
  secret_hash: string | null;
  scopes: unknown;
  status: string;
  requested_scopes: unknown | null;
  rate_limit_per_minute: number | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  reviewer_note: string | null;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
};

export type DeveloperKeyWithProfile = {
  key: DeveloperKeyRow;
  profileApprovedScopes: string[];
  rateLimitPerMinute: number | null;
};

export async function findActiveDeveloperKeyBySecretHash(
  secretHash: string,
): Promise<DeveloperKeyWithProfile | null> {
  const key = await mainDb
    .selectFrom("developer_api_keys")
    .selectAll()
    .where("secret_hash", "=", secretHash)
    .where("status", "=", "active")
    .where("revoked_at", "is", null)
    .executeTakeFirst();
  if (!key || key.secret_hash == null) return null;
  const profile = await mainDb
    .selectFrom("developer_profiles")
    .selectAll()
    .where("user_id", "=", key.user_id)
    .executeTakeFirst();
  if (!profile || profile.status !== "active") return null;
  const profileApprovedScopes = parseStringArray(profile.approved_scopes);
  const keyScopes = parseStringArray(key.scopes);
  const allowed = new Set(profileApprovedScopes);
  if (!keyScopes.length || !keyScopes.every((s) => allowed.has(s))) return null;
  return {
    key: key as DeveloperKeyRow,
    profileApprovedScopes,
    rateLimitPerMinute: key.rate_limit_per_minute,
  };
}

export async function insertDeveloperApiUsage(input: {
  keyId: string;
  userId: string;
  scopeId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ipHash: string | null;
  clientIp: string | null;
}) {
  try {
    await mainDb
      .insertInto("developer_api_usage")
      .values({
        key_id: input.keyId,
        user_id: input.userId,
        scope_id: input.scopeId,
        method: input.method,
        path: input.path,
        status_code: input.statusCode,
        duration_ms: input.durationMs,
        ip_hash: input.ipHash,
        client_ip: input.clientIp,
        created_at: new Date(),
      })
      .execute();
  } catch (e) {
    console.error("[developer_api_usage] insert failed:", e);
  }
}

export async function listApprovedDevelopersSummary() {
  const profiles = await mainDb.selectFrom("developer_profiles").selectAll().execute();
  const keys = await mainDb
    .selectFrom("developer_api_keys")
    .select(["user_id", "id", "revoked_at", "status", "secret_hash"])
    .execute();
  const lastUsage = await mainDb
    .selectFrom("developer_api_usage")
    .select(["user_id", sql<string>`max(created_at)`.as("last_at")])
    .groupBy("user_id")
    .execute();
  const lastByUser = new Map(lastUsage.map((r) => [r.user_id, r.last_at]));
  const keyCounts = new Map<string, { usable: number; total: number; pending: number }>();
  for (const k of keys) {
    const cur = keyCounts.get(k.user_id) ?? { usable: 0, total: 0, pending: 0 };
    cur.total += 1;
    if (!k.revoked_at) {
      if (k.status === "pending") cur.pending += 1;
      if (k.status === "active" && k.secret_hash != null) cur.usable += 1;
    }
    keyCounts.set(k.user_id, cur);
  }
  return profiles.map((p) => ({
    userId: p.user_id,
    status: p.status,
    approvedScopes: parseStringArray(p.approved_scopes),
    keysActive: keyCounts.get(p.user_id)?.usable ?? 0,
    keysPending: keyCounts.get(p.user_id)?.pending ?? 0,
    keysTotal: keyCounts.get(p.user_id)?.total ?? 0,
    lastApiActivity: lastByUser.get(p.user_id) ?? null,
    updatedAt: p.updated_at,
    adminNoticeSeq: Number(p.admin_notice_seq ?? 0),
    noticeDismissedSeq: Number(p.notice_dismissed_seq ?? 0),
  }));
}

export async function cleanupOldDeveloperUsage(daysToKeep: number): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  try {
    await mainDb.deleteFrom("developer_api_usage").where("created_at", "<", cutoff).execute();
  } catch (e) {
    console.error("[cleanupOldDeveloperUsage]", e);
  }
}

export async function deleteDeveloperAllDataForUser(userId: string): Promise<boolean> {
  const profile = await getDeveloperProfile(userId);
  if (!profile) return false;
  await mainDb.transaction().execute(async (trx) => {
    await trx.deleteFrom("developer_api_keys").where("user_id", "=", userId).execute();
    await trx.deleteFrom("developer_applications").where("user_id", "=", userId).execute();
    await trx.deleteFrom("developer_profiles").where("user_id", "=", userId).execute();
  });
  return true;
}