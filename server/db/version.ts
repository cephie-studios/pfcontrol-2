import { mainDb } from './connection.js'

export async function getAppVersion() {
  const result = await mainDb
    .selectFrom('app_settings')
    .select(['version', 'updated_at', 'updated_by'])
    .where('id', '=', 1)
    .executeTakeFirst();

  if (!result) {
    await mainDb
      .insertInto('app_settings')
      .values({
        id: 1,
        version: '2.0.0.3',
        updated_at: new Date(),
        updated_by: 'system'
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();

    return {
      version: '2.0.0.3',
      updated_at: new Date().toISOString(),
      updated_by: 'system'
    };
  }

  return {
    ...result,
    updated_at: result.updated_at?.toISOString() ?? null
  };
}

export async function updateAppVersion(version: string, updatedBy: string) {
  const result = await mainDb
    .insertInto('app_settings')
    .values({
      id: 1,
      version,
      updated_at: new Date(),
      updated_by: updatedBy
    })
    .onConflict((oc) =>
      oc.column('id').doUpdateSet({
        version: version,
        updated_at: new Date(),
        updated_by: updatedBy
      })
    )
    .returning(['version', 'updated_at', 'updated_by'])
    .executeTakeFirst();

  try {
    const { redisConnection } = await import('./connection.js');
    await redisConnection.del('app:version');
  } catch (error) {
    console.warn('[Redis] Failed to invalidate version cache:', error);
  }

  return {
    ...result,
    updated_at: result?.updated_at?.toISOString() ?? null
  };
}