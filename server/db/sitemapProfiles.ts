import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { MainDatabase } from './types/connection/MainDatabase.js';
import { decrypt } from '../utils/encryption.js';
import type { Settings } from './types/Settings.js';

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

  const remaining = await db
    .selectFrom('users')
    .select(['username', 'settings'])
    .execute();

  for (const row of remaining) {
    if (!row.username || usernames.has(row.username)) continue;
    if (!row.settings) continue;
    try {
      const raw =
        typeof row.settings === 'string'
          ? JSON.parse(row.settings)
          : row.settings;
      const settings = decrypt(raw) as Settings | null;
      if (
        settings?.bio?.trim() &&
        settings.displayBioOnProfile !== false
      ) {
        usernames.add(row.username);
      }
    } catch {
      continue;
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
