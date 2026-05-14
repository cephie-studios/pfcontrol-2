import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { MainDatabase } from './types/connection/MainDatabase.js';

function sslForConnectionString(connectionString: string) {
  const url = new URL(connectionString);
  const isLocalhost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === 'postgres';
  return isLocalhost ? false : { rejectUnauthorized: false };
}

export async function getSitemapProfileUsernames(
  db: Kysely<MainDatabase>,
  adminIds: string[]
): Promise<string[]> {
  const withRoles = await db
    .selectFrom('users as u')
    .innerJoin('user_roles as ur', 'ur.user_id', 'u.id')
    .select('u.username')
    .distinct()
    .execute();

  const usernames = new Set(
    withRoles
      .map((r) => r.username)
      .filter((name): name is string => Boolean(name))
  );

  if (adminIds.length > 0) {
    const admins = await db
      .selectFrom('users')
      .select('username')
      .where('id', 'in', adminIds)
      .execute();
    for (const row of admins) {
      if (row.username) usernames.add(row.username);
    }
  }

  return Array.from(usernames).sort((a, b) => a.localeCompare(b));
}

export async function querySitemapProfileUsernames(
  connectionString: string,
  adminIds: string[]
): Promise<string[]> {
  const pool = new pg.Pool({
    connectionString,
    ssl: sslForConnectionString(connectionString),
  });
  const db = new Kysely<MainDatabase>({
    dialect: new PostgresDialect({ pool }),
  });
  try {
    return await getSitemapProfileUsernames(db, adminIds);
  } finally {
    await db.destroy();
  }
}