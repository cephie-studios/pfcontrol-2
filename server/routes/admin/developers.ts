import express from "express";
import { createAuditLogger } from "../../middleware/auditLogger.js";
import { requirePermission } from "../../middleware/rolePermissions.js";
import {
  approvePendingDeveloperApiKey,
  bumpDeveloperAdminNoticeSeq,
  getDeveloperApiKeyForUser,
  getDeveloperApplicationById,
  getDeveloperProfile,
  listDeveloperApiKeysForAdmin,
  listDeveloperApplications,
  rejectPendingDeveloperApiKey,
  revokeDeveloperApiKey,
  updateApplicationReview,
  updateDeveloperApiKeyScopesAndRate,
  updateDeveloperProfileApprovedScopes,
  upsertDeveloperProfile,
  setDeveloperProfileStatus,
  listApprovedDevelopersSummary,
  deleteDeveloperAllDataForUser,
} from "../../db/developer.js";
import { buildNewDeveloperKeyCredentials } from "../../developer/apiKeySecret.js";
import {
  DEVELOPER_SCOPE_CATALOG,
  isScopeSubset,
  isValidScopeList,
} from "../../developer/scopeRegistry.js";
import { mainDb } from "../../db/connection.js";
import { getDeveloperApiDefaultRateLimitPerMinute } from "../../middleware/developerExtApi.js";
import { sendDeveloperAdminNoticeEmail } from "../../developer/sendDeveloperAdminNoticeEmail.js";

const SCOPE_LABEL = new Map(DEVELOPER_SCOPE_CATALOG.map((s) => [s.id, s.label]));

async function notifyDeveloperInAppAndEmail(userId: string, detail: string): Promise<void> {
  await bumpDeveloperAdminNoticeSeq(userId, detail);
  void sendDeveloperAdminNoticeEmail(userId, detail).catch((err) => {
    console.error("[developer admin notice email]", err);
  });
}

function labelScopes(ids: string[]): string {
  if (ids.length === 0) return "(none)";
  return ids.map((id) => SCOPE_LABEL.get(id) ?? id).join(", ");
}

function scopeListChange(prev: string[], next: string[]): string {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  const added = next.filter((id) => !prevSet.has(id));
  const removed = prev.filter((id) => !nextSet.has(id));
  if (!added.length && !removed.length) return "The allowed scope list was unchanged.";
  if (removed.length && added.length) {
    return `Removed: ${labelScopes(removed)}. Added: ${labelScopes(added)}.`;
  }
  if (removed.length) return `Removed: ${labelScopes(removed)}.`;
  return `Added: ${labelScopes(added)}.`;
}

function formatRpm(rpm: number | null | undefined): string {
  if (rpm == null) return "default server limit";
  return `${rpm} requests/minute`;
}

const DEVELOPER_ADMIN_NOTICE_SUCCESS_PREFIX = "[[success]]";

function applicationApprovedNotice(input: {
  requested: string[];
  approved: string[];
  rateLimitTouched: boolean;
  rateLimitValue: number | null;
  reviewerNote: string | null;
}): string {
  const scopesSame =
    JSON.stringify([...input.requested].sort()) === JSON.stringify([...input.approved].sort());
  const delta = scopeListChange(input.requested, input.approved);
  const scopeChanged = !scopesSame && delta !== "The allowed scope list was unchanged.";

  const bits: string[] = ["Your developer application was approved."];
  if (scopeChanged) {
    bits.push(`Compared to your request: ${delta}`);
  }
  if (input.rateLimitTouched) {
    bits.push(
      input.rateLimitValue != null
        ? `Default rate limit for new API keys: ${formatRpm(input.rateLimitValue)}.`
        : `Default rate limit for new API keys now follows the site-wide limit (${formatRpm(getDeveloperApiDefaultRateLimitPerMinute())}).`,
    );
  }
  if (input.reviewerNote?.trim()) {
    bits.push(`Note from reviewer: ${input.reviewerNote.trim()}`);
  }
  return `${DEVELOPER_ADMIN_NOTICE_SUCCESS_PREFIX}\n\n${bits.join("\n\n")}`;
}

function noticeKeyScopesAndRate(
  keyName: string,
  prevScopes: string[],
  nextScopes: string[],
  prevRpm: number | null,
  nextRpm: number | null,
): string {
  const sameScopes =
    JSON.stringify([...prevScopes].sort()) === JSON.stringify([...nextScopes].sort());
  const sameRpm = prevRpm === nextRpm;
  const bits: string[] = [`An administrator updated your API key "${keyName}".`];
  if (!sameScopes) bits.push(scopeListChange(prevScopes, nextScopes));
  if (!sameRpm) {
    bits.push(`Rate limit changed from ${formatRpm(prevRpm)} to ${formatRpm(nextRpm)}.`);
  }
  return bits.join(" ");
}

const router = express.Router();
router.use(requirePermission("admin"));

router.get("/catalog", createAuditLogger("ADMIN_DEVELOPER_SCOPE_CATALOG"), (_req, res) => {
  res.json({ scopes: DEVELOPER_SCOPE_CATALOG });
});

function normalizeScopes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

router.get(
  "/applications",
  createAuditLogger("ADMIN_DEVELOPER_APPLICATIONS_LIST"),
  async (req, res) => {
    try {
      const page =
        typeof req.query.page === "string" ? Math.max(1, parseInt(req.query.page, 10) || 1) : 1;
      const limit =
        typeof req.query.limit === "string"
          ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
          : 20;
      const statusRaw = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const status = statusRaw.length > 0 ? statusRaw : undefined;
      const { applications, total } = await listDeveloperApplications({
        status,
        page,
        limit,
      });
      const userIds = [...new Set(applications.map((a) => a.user_id))];
      const users =
        userIds.length > 0
          ? await mainDb
              .selectFrom("users")
              .select(["id", "username"])
              .where("id", "in", userIds)
              .execute()
          : [];
      const userMap = new Map(users.map((u) => [u.id, u.username]));
      res.json({
        applications: applications.map((a) => ({
          id: a.id,
          userId: a.user_id,
          username: userMap.get(a.user_id) ?? a.user_id,
          whoText: a.who_text,
          whyText: a.why_text,
          requestedScopes: normalizeScopes(a.requested_scopes),
          status: a.status,
          reviewedBy: a.reviewed_by,
          reviewedAt: a.reviewed_at,
          reviewerNote: a.reviewer_note,
          approvedScopes: a.approved_scopes ? normalizeScopes(a.approved_scopes) : null,
          createdAt: a.created_at,
        })),
        total,
        page,
        limit,
      });
    } catch (e) {
      console.error("[admin/developers applications]", e);
      res.status(500).json({ error: "Failed to list applications" });
    }
  },
);

router.post(
  "/applications/:id/approve",
  createAuditLogger("ADMIN_DEVELOPER_APPLICATION_APPROVED"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
      const app = await getDeveloperApplicationById(id);
      if (!app) return res.status(404).json({ error: "Application not found" });
      if (app.status !== "pending") {
        return res.status(400).json({ error: "Application is not pending" });
      }
      const requested = normalizeScopes(app.requested_scopes);
      const { approvedScopes: bodyScopes, rateLimitPerMinute: bodyRpm, note } = req.body ?? {};
      let approved: string[];
      if (bodyScopes === undefined || bodyScopes === null) {
        approved = requested;
      } else {
        if (!isValidScopeList(bodyScopes)) {
          return res
            .status(400)
            .json({ error: "approvedScopes must be a non-empty array of valid scope ids" });
        }
        approved = bodyScopes;
      }

      let rpmInput: number | null | undefined = undefined;
      if (
        req.body != null &&
        Object.prototype.hasOwnProperty.call(req.body, "rateLimitPerMinute")
      ) {
        const v = bodyRpm;
        if (v === null || v === "") {
          rpmInput = null;
        } else {
          const n = typeof v === "number" ? v : Number(v);
          if (!Number.isFinite(n) || n < 0) {
            return res.status(400).json({ error: "rateLimitPerMinute invalid" });
          }
          rpmInput = n === 0 ? null : Math.floor(n);
        }
      }

      const reviewedBy = req.user?.userId ?? "unknown";
      const reviewerNote = typeof note === "string" ? note : null;
      await updateApplicationReview({
        applicationId: id,
        status: "approved",
        reviewedBy,
        reviewerNote,
        approvedScopes: approved,
      });
      await upsertDeveloperProfile({
        userId: app.user_id,
        approvedScopes: approved,
        status: "active",
        ...(rpmInput !== undefined ? { defaultRateLimitPerMinute: rpmInput } : {}),
      });
      const notice = applicationApprovedNotice({
        requested,
        approved,
        rateLimitTouched: rpmInput !== undefined,
        rateLimitValue: rpmInput === undefined ? null : rpmInput,
        reviewerNote,
      });
      await notifyDeveloperInAppAndEmail(app.user_id, notice);
      res.json({ ok: true, userId: app.user_id, approvedScopes: approved });
    } catch (e) {
      console.error("[admin/developers approve]", e);
      res.status(500).json({ error: "Failed to approve application" });
    }
  },
);

router.post(
  "/applications/:id/reject",
  createAuditLogger("ADMIN_DEVELOPER_APPLICATION_REJECTED"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
      const app = await getDeveloperApplicationById(id);
      if (!app) return res.status(404).json({ error: "Application not found" });
      if (app.status !== "pending") {
        return res.status(400).json({ error: "Application is not pending" });
      }
      const reviewedBy = req.user?.userId ?? "unknown";
      await updateApplicationReview({
        applicationId: id,
        status: "rejected",
        reviewedBy,
        reviewerNote: typeof req.body?.note === "string" ? req.body.note : null,
        approvedScopes: null,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[admin/developers reject]", e);
      res.status(500).json({ error: "Failed to reject application" });
    }
  },
);

router.get("/developers", createAuditLogger("ADMIN_DEVELOPERS_LIST"), async (_req, res) => {
  try {
    const rows = await listApprovedDevelopersSummary();
    const userIds = rows.map((r) => r.userId);
    const users =
      userIds.length > 0
        ? await mainDb
            .selectFrom("users")
            .select(["id", "username", "avatar"])
            .where("id", "in", userIds)
            .execute()
        : [];
    const userMap = new Map(
      users.map((u) => [u.id, { username: u.username, avatar: u.avatar ?? null }]),
    );
    res.json({
      developers: rows.map((r) => {
        const u = userMap.get(r.userId);
        return {
          ...r,
          username: u?.username ?? r.userId,
          avatar: u?.avatar ?? null,
        };
      }),
    });
  } catch (e) {
    console.error("[admin/developers list]", e);
    res.status(500).json({ error: "Failed to list developers" });
  }
});

router.delete(
  "/profiles/:userId",
  createAuditLogger("ADMIN_DEVELOPER_DELETED"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const ok = await deleteDeveloperAllDataForUser(userId);
      if (!ok) return res.status(404).json({ error: "Developer profile not found" });
      res.json({ ok: true });
    } catch (e) {
      console.error("[admin/developers delete]", e);
      res.status(500).json({ error: "Failed to delete developer" });
    }
  },
);

router.patch(
  "/profiles/:userId/scopes",
  createAuditLogger("ADMIN_DEVELOPER_PROFILE_SCOPES_UPDATED"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { approvedScopes } = req.body ?? {};
      if (!isValidScopeList(approvedScopes)) {
        return res
          .status(400)
          .json({ error: "approvedScopes must be a non-empty array of valid scope ids" });
      }
      const prior = await getDeveloperProfile(userId);
      const prevScopes = prior ? normalizeScopes(prior.approved_scopes) : [];
      const row = await updateDeveloperProfileApprovedScopes(userId, approvedScopes);
      if (!row) return res.status(404).json({ error: "Developer profile not found" });
      await notifyDeveloperInAppAndEmail(
        userId,
        `An administrator updated your allowed API scopes. ${scopeListChange(prevScopes, approvedScopes)}`,
      );
      res.json({ ok: true, approvedScopes });
    } catch (e) {
      console.error("[admin/developers profile scopes]", e);
      res.status(500).json({ error: "Failed to update profile scopes" });
    }
  },
);

router.get("/:userId/keys", createAuditLogger("ADMIN_DEVELOPER_KEYS_LIST"), async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await getDeveloperProfile(userId);
    if (!profile) return res.status(404).json({ error: "Developer profile not found" });
    const keys = await listDeveloperApiKeysForAdmin(userId);
    res.json({
      keys: keys.map((k) => ({
        id: String(k.id),
        name: k.name,
        prefix: k.prefix,
        status: k.status ?? "active",
        scopes: normalizeScopes(k.scopes),
        requestedScopes: k.requested_scopes ? normalizeScopes(k.requested_scopes) : [],
        rateLimitPerMinute: k.rate_limit_per_minute,
        reviewedBy: k.reviewed_by,
        reviewedAt: k.reviewed_at,
        reviewerNote: k.reviewer_note,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
        revokedAt: k.revoked_at,
      })),
    });
  } catch (e) {
    console.error("[admin/developers keys list]", e);
    res.status(500).json({ error: "Failed to list keys" });
  }
});

router.post(
  "/:userId/keys/:keyId/approve",
  createAuditLogger("ADMIN_DEVELOPER_KEY_APPROVED"),
  async (req, res) => {
    try {
      const { userId, keyId } = req.params;
      const profile = await getDeveloperProfile(userId);
      if (!profile || profile.status !== "active") {
        return res.status(404).json({ error: "Developer profile not found or not active" });
      }
      const key = await getDeveloperApiKeyForUser(keyId, userId);
      if (!key || key.status !== "pending") {
        return res.status(400).json({ error: "Key not found or not pending approval" });
      }
      const requested = normalizeScopes(key.requested_scopes);
      const ceiling = normalizeScopes(profile.approved_scopes);
      const { approvedScopes, rateLimitPerMinute } = req.body ?? {};
      if (!isValidScopeList(approvedScopes)) {
        return res.status(400).json({ error: "approvedScopes invalid" });
      }
      if (!isScopeSubset(approvedScopes, requested)) {
        return res
          .status(400)
          .json({ error: "approvedScopes must be a subset of requested scopes" });
      }
      if (!isScopeSubset(approvedScopes, ceiling)) {
        return res
          .status(400)
          .json({ error: "approvedScopes must be within the developer profile ceiling" });
      }
      const rpm =
        rateLimitPerMinute === undefined || rateLimitPerMinute === null
          ? null
          : typeof rateLimitPerMinute === "number"
            ? rateLimitPerMinute
            : Number(rateLimitPerMinute);
      if (rpm != null && (!Number.isFinite(rpm) || rpm < 0)) {
        return res.status(400).json({ error: "rateLimitPerMinute invalid" });
      }

      const { secret, prefix, secretHash } = buildNewDeveloperKeyCredentials();
      const reviewedBy = req.user?.userId ?? "unknown";
      const row = await approvePendingDeveloperApiKey({
        keyId,
        userId,
        approvedScopes,
        prefix,
        secretHash,
        rateLimitPerMinute: rpm,
        reviewedBy,
        reviewerNote: typeof req.body?.note === "string" ? req.body.note : null,
      });
      if (!row) {
        return res.status(500).json({ error: "Failed to approve key" });
      }
      let approveDetail = `An administrator approved your API key "${key.name}" with scopes: ${labelScopes(approvedScopes)}.`;
      if (rpm != null) approveDetail += ` Rate limit: ${formatRpm(rpm)}.`;
      await notifyDeveloperInAppAndEmail(userId, approveDetail);
      res.json({
        ok: true,
        id: String(row.id),
        prefix: row.prefix,
        scopes: normalizeScopes(row.scopes),
        secret,
      });
    } catch (e) {
      console.error("[admin/developers key approve]", e);
      res.status(500).json({ error: "Failed to approve key" });
    }
  },
);

router.post(
  "/:userId/keys/:keyId/reject",
  createAuditLogger("ADMIN_DEVELOPER_KEY_REJECTED"),
  async (req, res) => {
    try {
      const { userId, keyId } = req.params;
      const reviewedBy = req.user?.userId ?? "unknown";
      const row = await rejectPendingDeveloperApiKey({
        keyId,
        userId,
        reviewedBy,
        reviewerNote: typeof req.body?.note === "string" ? req.body.note : null,
      });
      if (!row) return res.status(400).json({ error: "Key not found or not pending" });
      await notifyDeveloperInAppAndEmail(
        userId,
        `An administrator rejected your pending API key "${row.name}".`,
      );
      res.json({ ok: true });
    } catch (e) {
      console.error("[admin/developers key reject]", e);
      res.status(500).json({ error: "Failed to reject key" });
    }
  },
);

router.patch(
  "/:userId/keys/:keyId",
  createAuditLogger("ADMIN_DEVELOPER_KEY_UPDATED"),
  async (req, res) => {
    try {
      const { userId, keyId } = req.params;
      const profile = await getDeveloperProfile(userId);
      if (!profile || profile.status !== "active") {
        return res.status(404).json({ error: "Developer profile not found or not active" });
      }
      const key = await getDeveloperApiKeyForUser(keyId, userId);
      if (!key || key.status !== "active" || key.revoked_at) {
        return res.status(400).json({ error: "Key not found or not editable" });
      }
      const { scopes, rateLimitPerMinute } = req.body ?? {};
      if (!isValidScopeList(scopes)) {
        return res.status(400).json({ error: "scopes invalid" });
      }
      const ceiling = normalizeScopes(profile.approved_scopes);
      if (!isScopeSubset(scopes, ceiling)) {
        return res.status(400).json({ error: "scopes must be within profile ceiling" });
      }
      const rpm =
        rateLimitPerMinute === undefined
          ? (key.rate_limit_per_minute as number | null)
          : rateLimitPerMinute === null
            ? null
            : typeof rateLimitPerMinute === "number"
              ? rateLimitPerMinute
              : Number(rateLimitPerMinute);
      if (rpm != null && (!Number.isFinite(rpm) || rpm < 0)) {
        return res.status(400).json({ error: "rateLimitPerMinute invalid" });
      }
      const prevScopes = normalizeScopes(key.scopes);
      const prevRpm = (key.rate_limit_per_minute ?? null) as number | null;
      const row = await updateDeveloperApiKeyScopesAndRate({
        keyId,
        userId,
        scopes,
        rateLimitPerMinute: rpm,
      });
      if (!row) return res.status(500).json({ error: "Failed to update key" });
      const nextScopes = normalizeScopes(row.scopes);
      const nextRpm = (row.rate_limit_per_minute ?? null) as number | null;
      await notifyDeveloperInAppAndEmail(
        userId,
        noticeKeyScopesAndRate(key.name, prevScopes, nextScopes, prevRpm, nextRpm),
      );
      res.json({
        ok: true,
        id: String(row.id),
        scopes: normalizeScopes(row.scopes),
        rateLimitPerMinute: row.rate_limit_per_minute,
      });
    } catch (e) {
      console.error("[admin/developers key patch]", e);
      res.status(500).json({ error: "Failed to update key" });
    }
  },
);

router.post(
  "/:userId/keys/:keyId/revoke",
  createAuditLogger("ADMIN_DEVELOPER_KEY_REVOKED"),
  async (req, res) => {
    try {
      const { userId, keyId } = req.params;
      const row = await revokeDeveloperApiKey(keyId, userId);
      if (!row) return res.status(404).json({ error: "Key not found or already revoked" });
      await notifyDeveloperInAppAndEmail(
        userId,
        `An administrator revoked your API key "${row.name}".`,
      );
      res.json({ ok: true });
    } catch (e) {
      console.error("[admin/developers key revoke]", e);
      res.status(500).json({ error: "Failed to revoke key" });
    }
  },
);

router.post(
  "/profiles/:userId/suspend",
  createAuditLogger("ADMIN_DEVELOPER_PROFILE_SUSPENDED"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const row = await setDeveloperProfileStatus(userId, "suspended");
      if (!row) return res.status(404).json({ error: "Developer profile not found" });
      await notifyDeveloperInAppAndEmail(
        userId,
        "An administrator suspended your developer account. Your API keys no longer work until access is restored.",
      );
      res.json({ ok: true });
    } catch (e) {
      console.error("[admin/developers suspend]", e);
      res.status(500).json({ error: "Failed to suspend profile" });
    }
  },
);

router.post(
  "/profiles/:userId/reactivate",
  createAuditLogger("ADMIN_DEVELOPER_PROFILE_REACTIVATED"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const row = await setDeveloperProfileStatus(userId, "active");
      if (!row) return res.status(404).json({ error: "Developer profile not found" });
      await notifyDeveloperInAppAndEmail(
        userId,
        "An administrator reactivated your developer account. Your keys work again according to their current status.",
      );
      res.json({ ok: true });
    } catch (e) {
      console.error("[admin/developers reactivate]", e);
      res.status(500).json({ error: "Failed to reactivate profile" });
    }
  },
);

export default router;