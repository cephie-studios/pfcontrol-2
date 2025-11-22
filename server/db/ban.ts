import { mainDb } from './connection.js';
import { sql } from 'kysely';

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
    .selectFrom('bans')
    .selectAll()
    .orderBy('banned_at', 'desc')
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
