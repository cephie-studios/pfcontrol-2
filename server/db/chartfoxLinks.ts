import { sql } from 'kysely';
import { mainDb } from './connection.js';
import { encrypt, decrypt } from '../utils/encryption.js';

export interface ChartfoxLink {
  userId: string;
  chartfoxUserId: number | null;
  chartfoxName: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string | null;
}

type EncryptedValue = Parameters<typeof decrypt>[0];

function readSecret(value: unknown): string | null {
  if (!value) return null;
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  const plain = decrypt(parsed as EncryptedValue);
  return typeof plain === 'string' ? plain : null;
}

export async function getChartfoxLink(
  userId: string
): Promise<ChartfoxLink | null> {
  const row = await mainDb
    .selectFrom('chartfox_links')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!row) return null;

  const accessToken = readSecret(row.access_token);
  if (!accessToken) return null;

  return {
    userId: row.user_id,
    chartfoxUserId: row.chartfox_user_id,
    chartfoxName: row.chartfox_name,
    accessToken,
    refreshToken: readSecret(row.refresh_token),
    expiresAt: new Date(row.expires_at),
    scopes: row.scopes,
  };
}

export async function saveChartfoxLink(link: ChartfoxLink): Promise<void> {
  const values = {
    chartfox_user_id: link.chartfoxUserId,
    chartfox_name: link.chartfoxName,
    access_token: JSON.stringify(encrypt(link.accessToken)),
    refresh_token: link.refreshToken
      ? JSON.stringify(encrypt(link.refreshToken))
      : null,
    expires_at: link.expiresAt,
    scopes: link.scopes,
  };

  await mainDb
    .insertInto('chartfox_links')
    .values({ user_id: link.userId, ...values })
    .onConflict((oc) =>
      oc.column('user_id').doUpdateSet({ ...values, updated_at: sql`now()` })
    )
    .execute();
}

export async function deleteChartfoxLink(userId: string): Promise<void> {
  await mainDb
    .deleteFrom('chartfox_links')
    .where('user_id', '=', userId)
    .execute();
}
