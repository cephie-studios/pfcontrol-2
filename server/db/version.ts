import { mainDb } from './connection.js';
import {
  APP_VERSION_REDIS_SEC,
  DEPLOYMENT,
  prefixKey,
} from '../utils/cacheTtl.js';

export async function getAppVersion() {
  const result = await mainDb
    .selectFrom('app_settings')
    .select(['version', 'updated_at', 'updated_by'])
    .where('channel', '=', DEPLOYMENT)
    .executeTakeFirst();

  if (!result) {
    return {
      version: '2.0.0',
      updated_at: new Date().toISOString(),
      updated_by: 'system',
    };
  }

  const versionData = {
    ...result,
    updated_at: result.updated_at?.toISOString() ?? null,
  };

  try {
    const { redisConnection } = await import('./connection.js');
    await redisConnection.set(
      prefixKey('app:version'),
      JSON.stringify(versionData),
      'EX',
      APP_VERSION_REDIS_SEC
    );
  } catch (error) {
    console.warn('[Redis] Failed to set version cache:', error);
  }

  return versionData;
}

export async function updateAppVersion(version: string, updatedBy: string) {
  const result = await mainDb
    .insertInto('app_settings')
    .values({
      version,
      channel: DEPLOYMENT,
      updated_at: new Date(),
      updated_by: updatedBy,
    })
    .onConflict((oc) =>
      oc.column('channel').doUpdateSet({
        version,
        updated_at: new Date(),
        updated_by: updatedBy,
      })
    )
    .returning(['version', 'updated_at', 'updated_by'])
    .executeTakeFirst();

  try {
    const { redisConnection } = await import('./connection.js');
    await redisConnection.del(prefixKey('app:version'));
  } catch (error) {
    console.warn('[Redis] Failed to invalidate version cache:', error);
  }

  return {
    ...result,
    updated_at: result?.updated_at?.toISOString() ?? null,
  };
}
