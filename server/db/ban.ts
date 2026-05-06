import { mainDb, redisConnection } from './connection.js';
import { sql } from 'kysely';

const BAN_CACHE_TTL = 60; // seconds

export async function banUser({
  userId,
  ip,
  username,
  reason,
  bannedBy,
  expiresAt,
}: {
  userId?: string;
  ip?: string;
  username: string;
  reason: string;
  bannedBy: string;
  expiresAt?: string;
}): Promise<void> {
  if (!userId && !ip) {
    throw new Error('Either userId or ip must be provided');
  }
  const expiresAtValue = expiresAt === '' ? undefined : expiresAt;

  await mainDb
    .insertInto('bans')
    .values({
      id: sql`DEFAULT`,
      user_id: userId || undefined,
      ip_address: ip || undefined,
      username,
      reason,
      banned_by: bannedBy,
      expires_at: expiresAtValue as Date | undefined,
      active: true,
    })
    .execute();

  if (userId) {
    await redisConnection.setex(`ban:${userId}`, BAN_CACHE_TTL, '1');
  }
}

export async function unbanUser(userIdOrIp: string): Promise<void> {
  await mainDb
    .updateTable('bans')
    .set({ active: false })
    .where(({ or, eb }) =>
      or([eb('user_id', '=', userIdOrIp), eb('ip_address', '=', userIdOrIp)])
    )
    .where('active', '=', true)
    .execute();

  await redisConnection.del(`ban:${userIdOrIp}`);
  await redisConnection.del(`ban:ip:${userIdOrIp}`);
}

export async function isUserBanned(userId: string) {
  const result = await mainDb
    .selectFrom('bans')
    .selectAll()
    .where('user_id', '=', userId)
    .where('active', '=', true)
    .where(({ or, eb }) =>
      or([eb('expires_at', 'is', null), eb('expires_at', '>', new Date())])
    )
    .executeTakeFirst();
  return result ?? null;
}

export async function isIpBanned(ip: string) {
  const result = await mainDb
    .selectFrom('bans')
    .selectAll()
    .where('ip_address', '=', ip)
    .where('active', '=', true)
    .where(({ or, eb }) =>
      or([eb('expires_at', 'is', null), eb('expires_at', '>', new Date())])
    )
    .executeTakeFirst();
  return result ?? null;
}

export async function getAllBans(page = 1, limit = 50) {
  const offset = (page - 1) * limit;

  const bans = await mainDb
    .selectFrom('bans as b')
    .leftJoin('users as mod', 'b.banned_by', 'mod.id')
    .leftJoin('users as target', 'b.user_id', 'target.id')
    .select([
      'b.id',
      'b.user_id',
      'b.ip_address',
      'b.username',
      'b.reason',
      'b.banned_by',
      'b.banned_at',
      'b.expires_at',
      'b.active',
      'mod.username as banned_by_username',
      'mod.avatar as banned_by_avatar',
      'target.username as target_username',
    ])
    .orderBy('b.banned_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();

  const [{ count }] = await mainDb
    .selectFrom('bans')
    .select(({ fn }) => [fn.countAll().as('count')])
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
