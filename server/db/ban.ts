import { mainDb, redisConnection } from "./connection.js";
import { sql } from "kysely";

export const BAN_CACHE_TTL = 60; // seconds

export async function banUser({
  userId,
  ip,
  username,
  reason,
  bannedBy,
  expiresAt,
  fingerprintId,
}: {
  userId?: string;
  ip?: string;
  username: string;
  reason: string;
  bannedBy: string;
  expiresAt?: string;
  fingerprintId?: string | null;
}): Promise<void> {
  if (!userId && !ip) {
    throw new Error("Either userId or ip must be provided");
  }
  const expiresAtValue = expiresAt === "" ? undefined : expiresAt;

  await mainDb
    .insertInto("bans")
    .values({
      id: sql`DEFAULT`,
      user_id: userId || undefined,
      ip_address: ip || undefined,
      username,
      reason,
      banned_by: bannedBy,
      expires_at: expiresAtValue as Date | undefined,
      active: true,
      fingerprint_id: fingerprintId || undefined,
    })
    .execute();

  if (userId) {
    await redisConnection.setex(`ban:${userId}`, BAN_CACHE_TTL, "1");
  }
  if (ip) {
    await redisConnection.setex(`ban:ip:${ip}`, BAN_CACHE_TTL, "1");
  }
  if (fingerprintId) {
    await redisConnection.setex(`ban:fp:${fingerprintId}`, BAN_CACHE_TTL, "1");
  }
}

export async function isFingerprintBanned(
  fingerprintId: string
): Promise<boolean> {
  const cacheKey = `ban:fp:${fingerprintId}`;
  const cached = await redisConnection.get(cacheKey);
  if (cached === "1") return true;

  const result = await mainDb
    .selectFrom("bans")
    .select("id")
    .where("fingerprint_id", "=", fingerprintId)
    .where("active", "=", true)
    .where(({ or, eb }) =>
      or([eb("expires_at", "is", null), eb("expires_at", ">", new Date())])
    )
    .executeTakeFirst();

  const banned = !!result;
  if (banned) {
    await redisConnection.setex(cacheKey, BAN_CACHE_TTL, "1");
  }
  return banned;
}

export async function unbanUser(userIdOrIp: string): Promise<void> {
  // Fetch fingerprint_id before deactivating so we can clear its cache
  const bans = await mainDb
    .selectFrom("bans")
    .select("fingerprint_id")
    .where(({ or, eb }) =>
      or([eb("user_id", "=", userIdOrIp), eb("ip_address", "=", userIdOrIp)])
    )
    .where("active", "=", true)
    .execute();

  await mainDb
    .updateTable("bans")
    .set({ active: false })
    .where(({ or, eb }) =>
      or([eb("user_id", "=", userIdOrIp), eb("ip_address", "=", userIdOrIp)])
    )
    .where("active", "=", true)
    .execute();

  await redisConnection.del(`ban:${userIdOrIp}`);
  await redisConnection.del(`ban:ip:${userIdOrIp}`);

  for (const ban of bans) {
    if (ban.fingerprint_id) {
      await redisConnection.del(`ban:fp:${ban.fingerprint_id}`);
    }
  }
}

export async function isUserBanned(userId: string) {
  const result = await mainDb
    .selectFrom("bans")
    .selectAll()
    .where("user_id", "=", userId)
    .where("active", "=", true)
    .where(({ or, eb }) =>
      or([eb("expires_at", "is", null), eb("expires_at", ">", new Date())])
    )
    .executeTakeFirst();
  return result ?? null;
}

export async function isIpBanned(ip: string) {
  const result = await mainDb
    .selectFrom("bans")
    .selectAll()
    .where("ip_address", "=", ip)
    .where("active", "=", true)
    .where(({ or, eb }) =>
      or([eb("expires_at", "is", null), eb("expires_at", ">", new Date())])
    )
    .executeTakeFirst();
  return result ?? null;
}

export async function getAllBans(page = 1, limit = 50) {
  const offset = (page - 1) * limit;

  const bans = await mainDb
    .selectFrom("bans as b")
    .leftJoin("users as mod", "b.banned_by", "mod.id")
    .leftJoin("users as target", "b.user_id", "target.id")
    .select([
      "b.id",
      "b.user_id",
      "b.ip_address",
      "b.username",
      "b.reason",
      "b.banned_by",
      "b.banned_at",
      "b.expires_at",
      "b.active",
      "mod.username as banned_by_username",
      "mod.avatar as banned_by_avatar",
      "target.username as target_username",
    ])
    .where("b.active", "=", true)
    .orderBy("b.banned_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  const [{ count }] = await mainDb
    .selectFrom("bans")
    .select(({ fn }) => [fn.countAll().as("count")])
    .where("active", "=", true)
    .execute();

  const total = Number(count);

  return {
    bans,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}
