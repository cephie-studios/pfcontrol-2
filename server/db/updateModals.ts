import { mainDb } from './connection.js';
import { sql } from 'kysely';
import { redisConnection } from './connection.js';

const ACTIVE_MODAL_CACHE_KEY = 'update_modal:active';
const CACHE_TTL = 24 * 60 * 60; // 24 hours (but we'll invalidate manually)

export async function getActiveUpdateModal() {
  try {
    const cached = await redisConnection.get(ACTIVE_MODAL_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn('[Redis] Failed to get active modal from cache:', error);
  }

  const modal = await mainDb
    .selectFrom('update_modals')
    .selectAll()
    .where('is_active', '=', true)
    .orderBy('published_at', 'desc')
    .executeTakeFirst();

  const result = modal || null;

  try {
    await redisConnection.set(
      ACTIVE_MODAL_CACHE_KEY,
      JSON.stringify(result),
      'EX',
      CACHE_TTL
    );
  } catch (error) {
    console.warn('[Redis] Failed to cache active modal:', error);
  }

  return result;
}

async function invalidateActiveModalCache() {
  try {
    await redisConnection.del(ACTIVE_MODAL_CACHE_KEY);
  } catch (error) {
    console.warn('[Redis] Failed to invalidate active modal cache:', error);
  }
}

export async function getAllUpdateModals() {
  const modals = await mainDb
    .selectFrom('update_modals')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute();

  return modals;
}

export async function getUpdateModalById(id: number) {
  const modal = await mainDb
    .selectFrom('update_modals')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();

  return modal || null;
}

export async function createUpdateModal(data: {
  title: string;
  content: string;
  banner_url?: string;
}) {
  const modal = await mainDb
    .insertInto('update_modals')
    .values({
      title: data.title,
      content: data.content,
      banner_url: data.banner_url || undefined,
      is_active: false,
      created_at: sql`NOW()`,
      updated_at: sql`NOW()`,
    })
    .returningAll()
    .executeTakeFirst();

  return modal;
}

export async function updateUpdateModal(
  id: number,
  data: {
    title?: string;
    content?: string;
    banner_url?: string;
  }
) {
  const modal = await mainDb
    .updateTable('update_modals')
    .set({
      ...data,
      updated_at: sql`NOW()`,
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  if (modal?.is_active) {
    await invalidateActiveModalCache();
  }

  return modal;
}

export async function deleteUpdateModal(id: number) {
  const modal = await getUpdateModalById(id);
  const wasActive = modal?.is_active;

  await mainDb.deleteFrom('update_modals').where('id', '=', id).execute();

  if (wasActive) {
    await invalidateActiveModalCache();
  }
}

export async function publishUpdateModal(id: number) {
  await mainDb
    .updateTable('update_modals')
    .set({ is_active: false })
    .where('is_active', '=', true)
    .execute();

  const modal = await mainDb
    .updateTable('update_modals')
    .set({
      is_active: true,
      published_at: sql`NOW()`,
      updated_at: sql`NOW()`,
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  await invalidateActiveModalCache();

  return modal;
}

export async function unpublishUpdateModal(id: number) {
  const modal = await mainDb
    .updateTable('update_modals')
    .set({
      is_active: false,
      updated_at: sql`NOW()`,
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  await invalidateActiveModalCache();

  return modal;
}
