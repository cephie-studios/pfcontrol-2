import { mainDb, redisConnection } from './connection.js';
import { sql } from 'kysely';

const CACHE_TTL = 60; // seconds
const GATE_CACHE_TTL = 30; // seconds

export async function addVpnException(
  userId: string,
  username: string,
  addedBy: string,
  addedByUsername: string,
  notes: string = ''
) {
  const result = await mainDb
    .insertInto('vpn_exceptions')
    .values({
      id: sql`DEFAULT`,
      user_id: userId,
      username,
      added_by: addedBy,
      added_by_username: addedByUsername,
      notes,
      updated_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column('user_id').doUpdateSet({
        username,
        notes,
        updated_at: new Date(),
      })
    )
    .returningAll()
    .executeTakeFirst();

  await redisConnection.del(`vpn_exception:${userId}`);
  return result;
}

export async function removeVpnException(userId: string) {
  const result = await mainDb
    .deleteFrom('vpn_exceptions')
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirst();

  await redisConnection.del(`vpn_exception:${userId}`);
  return result;
}

export async function isVpnException(userId: string): Promise<boolean> {
  const cached = await redisConnection.get(`vpn_exception:${userId}`);
  if (cached !== null) {
    return cached === '1';
  }

  const result = await mainDb
    .selectFrom('vpn_exceptions')
    .select('id')
    .where('user_id', '=', userId)
    .executeTakeFirst();

  const isException = !!result;
  await redisConnection.setex(`vpn_exception:${userId}`, CACHE_TTL, isException ? '1' : '0');
  return isException;
}

export async function getAllVpnExceptions(
  page: number = 1,
  limit: number = 50,
  search: string = ''
) {
  const offset = (page - 1) * limit;
  let query = mainDb
    .selectFrom('vpn_exceptions as v')
    .leftJoin('users as u', 'v.user_id', 'u.id')
    .select([
      'v.id',
      'v.user_id',
      'v.username',
      'v.added_by',
      'v.added_by_username',
      'v.notes',
      'v.created_at',
      'v.updated_at',
      'u.avatar as avatar',
    ])
    .orderBy('v.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  if (search && search.trim()) {
    query = query.where((eb) =>
      eb.or([
        eb('v.username', 'ilike', `%${search.trim()}%`),
        eb('v.user_id', '=', search.trim()),
      ])
    );
  }

  const exceptions = await query.execute();

  let countQuery = mainDb
    .selectFrom('vpn_exceptions as v')
    .select(({ fn }) => [fn.countAll().as('count')]);
  if (search && search.trim()) {
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb('v.username', 'ilike', `%${search.trim()}%`),
        eb('v.user_id', '=', search.trim()),
      ])
    );
  }
  const countResult = await countQuery.executeTakeFirst();
  const total = Number(countResult?.count ?? 0);

  return {
    exceptions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getVpnGateSettings(): Promise<Record<string, boolean>> {
  const rows = await mainDb
    .selectFrom('vpn_gate_settings')
    .select(['setting_key', 'setting_value'])
    .execute();

  const settings: Record<string, boolean> = {};
  for (const row of rows) {
    settings[row.setting_key] = row.setting_value;
  }
  if (!('vpn_gate_enabled' in settings)) {
    settings['vpn_gate_enabled'] = false;
  }
  return settings;
}

export async function updateVpnGateSetting(key: string, value: boolean) {
  await mainDb
    .insertInto('vpn_gate_settings')
    .values({
      id: sql`DEFAULT`,
      setting_key: key,
      setting_value: value,
      updated_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column('setting_key').doUpdateSet({
        setting_value: value,
        updated_at: new Date(),
      })
    )
    .execute();

  await redisConnection.del('vpn_gate_enabled');
  return { [key]: value };
}

export async function isVpnGateEnabled(): Promise<boolean> {
  const cached = await redisConnection.get('vpn_gate_enabled');
  if (cached !== null) {
    return cached === '1';
  }

  const settings = await getVpnGateSettings();
  const enabled = settings['vpn_gate_enabled'] ?? false;
  await redisConnection.setex('vpn_gate_enabled', GATE_CACHE_TTL, enabled ? '1' : '0');
  return enabled;
}
