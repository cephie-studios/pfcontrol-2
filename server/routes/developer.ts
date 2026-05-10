import express from "express";
import requireAuth from "../middleware/auth.js";
import { verifyDeveloperNotificationUnsubscribeToken } from "../developer/developerNotificationUnsubscribeToken.js";
import {
  buildNewDeveloperKeyCredentials,
  newPendingDeveloperKeyPrefix,
} from "../developer/apiKeySecret.js";
import { buildDeveloperApiPublicSpec } from "../developer/apiDocumentation.js";
import {
  DEVELOPER_SCOPE_CATALOG,
  isScopeSubset,
  isValidScopeList,
} from "../developer/scopeRegistry.js";
import {
  createDeveloperApiKey,
  createDeveloperApplication,
  deleteRevokedDeveloperApiKey,
  dismissDeveloperAdminNotice,
  getDeveloperProfile,
  getLatestDeveloperApplication,
  updateDeveloperNotificationEmail,
  insertPendingDeveloperApiKey,
  listDeveloperKeysForUser,
  revokeDeveloperApiKey,
  rotateDeveloperApiKey,
} from "../db/developer.js";
import {
  getDeveloperRecentUsage,
  getDeveloperUsageByScope,
  getDeveloperUsageDailyCounts,
  getDeveloperUsageHourlyCounts,
} from "../db/developerDashboard.js";
import { getDeveloperApiDefaultRateLimitPerMinute } from "../middleware/developerExtApi.js";
import { mainDb } from "../db/connection.js";

const router = express.Router();

router.get("/docs", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(buildDeveloperApiPublicSpec());
});

const FRONTEND_BASE = (process.env.FRONTEND_URL ?? "").replace(/\/$/, "");

router.get("/notification-unsubscribe", async (req, res) => {
  const redirect = (query: string) => {
    const base = FRONTEND_BASE || "";
    res.redirect(302, `${base}/developers?notifyEmailRemoved=${query}`);
  };
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      redirect("invalid");
      return;
    }
    const parsed = verifyDeveloperNotificationUnsubscribeToken(token);
    if (!parsed) {
      redirect("invalid");
      return;
    }
    const profile = await getDeveloperProfile(parsed.userId);
    if (!profile) {
      redirect("invalid");
      return;
    }
    const current = (profile.notification_email ?? "").trim().toLowerCase();
    if (!current || current !== parsed.email) {
      redirect("stale");
      return;
    }
    const row = await updateDeveloperNotificationEmail(parsed.userId, null);
    if (!row) {
      redirect("invalid");
      return;
    }
    redirect("1");
  } catch (e) {
    console.error("[developer/notification-unsubscribe]", e);
    redirect("invalid");
  }
});

router.use(requireAuth);

const WHO_LEN = { min: 2, max: 2000 };
const WHY_LEN = { min: 10, max: 4000 };
const KEY_NAME_LEN = { min: 1, max: 120 };
const NOTIFICATION_EMAIL_MAX = 320;

function isValidNotificationEmail(s: string): boolean {
  const t = s.trim();
  if (t.length < 3 || t.length > NOTIFICATION_EMAIL_MAX) return false;
  if (/\s/.test(t)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

router.get("/catalog", (_req, res) => {
  res.json({ scopes: DEVELOPER_SCOPE_CATALOG });
});

router.patch("/profile/notification-email", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.user.userId;
    const profile = await getDeveloperProfile(userId);
    if (!profile || profile.status !== "active") {
      return res.status(403).json({ error: "Developer access not active" });
    }
    const { email } = req.body ?? {};
    let next: string | null;
    if (email === undefined || email === null) {
      next = null;
    } else if (typeof email !== "string") {
      return res.status(400).json({ error: "email must be a string or null" });
    } else {
      const t = email.trim();
      if (t.length === 0) {
        next = null;
      } else if (!isValidNotificationEmail(t)) {
        return res.status(400).json({ error: "email invalid" });
      } else {
        next = t;
      }
    }
    const row = await updateDeveloperNotificationEmail(userId, next);
    if (!row) return res.status(404).json({ error: "Developer profile not found" });
    const saved =
      typeof row.notification_email === "string" && row.notification_email.trim()
        ? row.notification_email.trim()
        : null;
    res.json({ ok: true, notificationEmail: saved });
  } catch (e) {
    console.error("[developer/profile notification-email]", e);
    res.status(500).json({ error: "Failed to update notification email" });
  }
});

router.post("/notice/dismiss", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const profile = await getDeveloperProfile(req.user.userId);
    if (!profile || profile.status !== "active") {
      return res.status(403).json({ error: "Developer access not active" });
    }
    await dismissDeveloperAdminNotice(req.user.userId);
    res.json({ ok: true });
  } catch (e) {
    console.error("[developer/notice dismiss]", e);
    res.status(500).json({ error: "Failed to dismiss notice" });
  }
});

router.get("/application", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.user.userId;
    const [profile, latestApplication] = await Promise.all([
      getDeveloperProfile(userId),
      getLatestDeveloperApplication(userId),
    ]);
    res.json({
      profile: profile
        ? {
            status: profile.status,
            approvedScopes: normalizeScopes(profile.approved_scopes),
            defaultRateLimitPerMinute: (() => {
              const raw = (profile as { default_rate_limit_per_minute?: number | null })
                .default_rate_limit_per_minute;
              return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
            })(),
            adminNoticeSeq: Number(profile.admin_notice_seq ?? 0),
            noticeDismissedSeq: Number(profile.notice_dismissed_seq ?? 0),
            adminNoticeDetail:
              typeof profile.admin_notice_detail === "string" ? profile.admin_notice_detail : null,
            notificationEmail:
              typeof profile.notification_email === "string" && profile.notification_email.trim()
                ? profile.notification_email.trim()
                : null,
          }
        : null,
      latestApplication: latestApplication
        ? {
            id: latestApplication.id,
            status: latestApplication.status,
            whoText: latestApplication.who_text,
            whyText: latestApplication.why_text,
            requestedScopes: normalizeScopes(latestApplication.requested_scopes),
            approvedScopes: latestApplication.approved_scopes
              ? normalizeScopes(latestApplication.approved_scopes)
              : null,
            reviewerNote: latestApplication.reviewer_note,
            reviewedAt: latestApplication.reviewed_at,
            createdAt: latestApplication.created_at,
          }
        : null,
    });
  } catch (e) {
    console.error("[developer/application GET]", e);
    res.status(500).json({ error: "Failed to load application" });
  }
});

function normalizeScopes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

router.post("/application", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.user.userId;
    const { who, why, requestedScopes } = req.body ?? {};
    if (typeof who !== "string" || typeof why !== "string") {
      return res.status(400).json({ error: "who and why must be strings" });
    }
    const whoTrim = who.trim();
    const whyTrim = why.trim();
    if (
      whoTrim.length < WHO_LEN.min ||
      whoTrim.length > WHO_LEN.max ||
      whyTrim.length < WHY_LEN.min ||
      whyTrim.length > WHY_LEN.max
    ) {
      return res.status(400).json({ error: "who / why length out of range" });
    }
    if (!isValidScopeList(requestedScopes)) {
      return res
        .status(400)
        .json({ error: "requestedScopes must be a non-empty array of valid scope ids" });
    }

    const profile = await getDeveloperProfile(userId);
    if (profile?.status === "active") {
      return res.status(400).json({ error: "You already have an active developer account" });
    }
    if (profile?.status === "suspended") {
      return res
        .status(400)
        .json({ error: "Your developer access is suspended. Contact an administrator." });
    }

    const pending = await mainDb
      .selectFrom("developer_applications")
      .select("id")
      .where("user_id", "=", userId)
      .where("status", "=", "pending")
      .executeTakeFirst();
    if (pending) {
      return res.status(400).json({ error: "You already have a pending application" });
    }

    const row = await createDeveloperApplication({
      userId,
      whoText: whoTrim,
      whyText: whyTrim,
      requestedScopes,
    });
    res.status(201).json({
      id: row?.id,
      status: row?.status ?? "pending",
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return res.status(400).json({ error: "You already have a pending application" });
    }
    console.error("[developer/application POST]", e);
    res.status(500).json({ error: "Failed to submit application" });
  }
});

router.post("/application/scope-expansion", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.user.userId;
    const { who, why, additionalScopes } = req.body ?? {};
    if (typeof who !== "string" || typeof why !== "string") {
      return res.status(400).json({ error: "who and why must be strings" });
    }
    const whoTrim = who.trim();
    const whyTrim = why.trim();
    if (
      whoTrim.length < WHO_LEN.min ||
      whoTrim.length > WHO_LEN.max ||
      whyTrim.length < WHY_LEN.min ||
      whyTrim.length > WHY_LEN.max
    ) {
      return res.status(400).json({ error: "who / why length out of range" });
    }
    if (!Array.isArray(additionalScopes)) {
      return res.status(400).json({ error: "additionalScopes must be an array" });
    }
    if (!isValidScopeList(additionalScopes)) {
      return res.status(400).json({
        error: "additionalScopes must be a non-empty array of valid scope ids",
      });
    }

    const profile = await getDeveloperProfile(userId);
    if (!profile || profile.status !== "active") {
      return res.status(403).json({ error: "Developer access not active" });
    }
    const current = normalizeScopes(profile.approved_scopes);
    const additional = additionalScopes.filter((s) => !current.includes(s));
    if (additional.length === 0) {
      return res.status(400).json({
        error: "Select at least one scope you do not already have approved",
      });
    }

    const pending = await mainDb
      .selectFrom("developer_applications")
      .select("id")
      .where("user_id", "=", userId)
      .where("status", "=", "pending")
      .executeTakeFirst();
    if (pending) {
      return res.status(400).json({ error: "You already have a pending application" });
    }

    const requestedUnion = [...new Set([...current, ...additional])];
    const row = await createDeveloperApplication({
      userId,
      whoText: whoTrim,
      whyText: whyTrim,
      requestedScopes: requestedUnion,
    });
    res.status(201).json({
      id: row?.id,
      status: row?.status ?? "pending",
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return res.status(400).json({ error: "You already have a pending application" });
    }
    console.error("[developer/application scope-expansion POST]", e);
    res.status(500).json({ error: "Failed to submit scope request" });
  }
});

router.get("/keys", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const profile = await getDeveloperProfile(req.user.userId);
    if (!profile || profile.status !== "active") {
      return res.status(403).json({ error: "Developer access not active" });
    }
    const keys = await listDeveloperKeysForUser(req.user.userId);
    const profileDefault = (profile as { default_rate_limit_per_minute?: number | null })
      .default_rate_limit_per_minute;
    const effectiveDefault =
      typeof profileDefault === "number" && Number.isFinite(profileDefault) && profileDefault > 0
        ? profileDefault
        : getDeveloperApiDefaultRateLimitPerMinute();
    res.json({
      defaultRateLimitPerMinute: effectiveDefault,
      keys: keys.map((k) => ({
        id: String(k.id),
        name: k.name,
        prefix: k.prefix,
        status: k.status ?? "active",
        scopes: normalizeScopes(k.scopes),
        requestedScopes: k.requested_scopes ? normalizeScopes(k.requested_scopes) : [],
        rateLimitPerMinute: k.rate_limit_per_minute,
        reviewedAt: k.reviewed_at,
        reviewerNote: k.reviewer_note,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
        revokedAt: k.revoked_at,
      })),
    });
  } catch (e) {
    console.error("[developer/keys GET]", e);
    res.status(500).json({ error: "Failed to list keys" });
  }
});

router.post("/keys", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.user.userId;
    const profile = await getDeveloperProfile(userId);
    if (!profile || profile.status !== "active") {
      return res.status(403).json({ error: "Developer access not active" });
    }
    const approved = normalizeScopes(profile.approved_scopes);
    const { name, scopes } = req.body ?? {};
    if (typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
    const nameTrim = name.trim();
    if (nameTrim.length < KEY_NAME_LEN.min || nameTrim.length > KEY_NAME_LEN.max) {
      return res.status(400).json({ error: "invalid name length" });
    }
    if (!isValidScopeList(scopes)) {
      return res.status(400).json({ error: "scopes must be a non-empty array of valid scope ids" });
    }

    if (isScopeSubset(scopes, approved)) {
      const profileDefault = (profile as { default_rate_limit_per_minute?: number | null })
        .default_rate_limit_per_minute;
      const keyRpm =
        typeof profileDefault === "number" && Number.isFinite(profileDefault) && profileDefault > 0
          ? Math.floor(profileDefault)
          : null;
      const { secret, prefix, secretHash } = buildNewDeveloperKeyCredentials();
      const row = await createDeveloperApiKey({
        userId,
        name: nameTrim,
        prefix,
        secretHash,
        scopes,
        rateLimitPerMinute: keyRpm,
      });
      if (!row) {
        return res.status(500).json({ error: "Failed to create key" });
      }
      res.status(201).json({
        id: String(row.id),
        name: row.name,
        prefix: row.prefix,
        status: "active",
        scopes: normalizeScopes(row.scopes),
        secret,
        createdAt: row.created_at,
      });
      return;
    }

    const row = await insertPendingDeveloperApiKey({
      userId,
      name: nameTrim,
      prefix: newPendingDeveloperKeyPrefix(),
      requestedScopes: scopes,
    });
    if (!row) {
      return res.status(500).json({ error: "Failed to submit key request" });
    }
    res.status(202).json({
      id: String(row.id),
      name: row.name,
      prefix: row.prefix,
      status: "pending",
      requestedScopes: scopes,
      message:
        "This key requests scopes outside your current allowance. An administrator must approve it before a secret is issued.",
      createdAt: row.created_at,
    });
  } catch (e) {
    console.error("[developer/keys POST]", e);
    res.status(500).json({ error: "Failed to create key" });
  }
});

router.post("/keys/:id/rotate", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.user.userId;
    const profile = await getDeveloperProfile(userId);
    if (!profile || profile.status !== "active") {
      return res.status(403).json({ error: "Developer access not active" });
    }
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "Missing id" });

    const { secret, prefix, secretHash } = buildNewDeveloperKeyCredentials();
    const row = await rotateDeveloperApiKey({
      keyId: id,
      userId,
      prefix,
      secretHash,
    });
    if (!row) {
      return res.status(404).json({ error: "Key not found or already revoked" });
    }
    res.status(200).json({
      id: String(row.id),
      name: row.name,
      prefix: row.prefix,
      scopes: normalizeScopes(row.scopes),
      secret,
      createdAt: row.created_at,
    });
  } catch (e) {
    console.error("[developer/keys rotate]", e);
    res.status(500).json({ error: "Failed to rotate key" });
  }
});

router.post("/keys/:id/revoke", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const profile = await getDeveloperProfile(req.user.userId);
    if (!profile || profile.status !== "active") {
      return res.status(403).json({ error: "Developer access not active" });
    }
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "Missing id" });
    const row = await revokeDeveloperApiKey(id, req.user.userId);
    if (!row) {
      return res.status(404).json({ error: "Key not found or already revoked" });
    }
    res.json({ ok: true, id: String(row.id) });
  } catch (e) {
    console.error("[developer/keys revoke]", e);
    res.status(500).json({ error: "Failed to revoke key" });
  }
});

router.delete("/keys/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const profile = await getDeveloperProfile(req.user.userId);
    if (!profile || profile.status !== "active") {
      return res.status(403).json({ error: "Developer access not active" });
    }
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "Missing id" });
    const row = await deleteRevokedDeveloperApiKey(id, req.user.userId);
    if (!row) {
      return res.status(404).json({ error: "Key not found or not yet revoked" });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[developer/keys DELETE]", e);
    res.status(500).json({ error: "Failed to delete key" });
  }
});

router.get("/dashboard/summary", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.user.userId;
    const profile = await getDeveloperProfile(userId);
    if (!profile || profile.status !== "active") {
      return res.status(403).json({ error: "Developer access not active" });
    }
    const hoursParam = req.query.hours;
    const daysParam = req.query.days;

    let daily: { date: string; count: number }[];
    let byScope: { scope_id: string; count: number }[];
    let days: number | undefined;
    let hours: number | undefined;
    let granularity: "day" | "hour" = "day";

    let recent: Awaited<ReturnType<typeof getDeveloperRecentUsage>>;

    if (typeof hoursParam === "string") {
      const h = Math.min(168, Math.max(1, parseInt(hoursParam, 10) || 24));
      hours = h;
      const since = new Date(Date.now() - h * 60 * 60 * 1000);
      const [hourly, scopeRows, recentRows] = await Promise.all([
        getDeveloperUsageHourlyCounts(userId, since),
        getDeveloperUsageByScope(userId, since),
        getDeveloperRecentUsage(userId, 25, 0),
      ]);
      daily = hourly;
      byScope = scopeRows;
      recent = recentRows;
      granularity = "hour";
    } else {
      const d =
        typeof daysParam === "string"
          ? Math.min(90, Math.max(1, parseInt(daysParam, 10) || 14))
          : 14;
      days = d;
      const since = new Date();
      since.setDate(since.getDate() - d);
      since.setHours(0, 0, 0, 0);
      const [dayRows, scopeRows, recentRows] = await Promise.all([
        getDeveloperUsageDailyCounts(userId, since),
        getDeveloperUsageByScope(userId, since),
        getDeveloperRecentUsage(userId, 25, 0),
      ]);
      daily = dayRows;
      byScope = scopeRows;
      recent = recentRows;
    }
    const totalInRange = daily.reduce((s, d) => s + d.count, 0);
    res.json({
      days,
      hours,
      granularity,
      daily,
      byScope,
      recent: recent.map((r) => ({
        id: String(r.id),
        scopeId: r.scope_id,
        method: r.method,
        path: r.path,
        statusCode: r.status_code,
        durationMs: r.duration_ms,
        createdAt: r.created_at,
        clientIp: r.client_ip ?? null,
      })),
      totalInRange,
    });
  } catch (e) {
    console.error("[developer/dashboard]", e);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

export default router;