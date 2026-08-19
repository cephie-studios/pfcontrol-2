import { mainDb } from './connection.js';
import { sql } from 'kysely';

export async function createUserNotification(input: {
  userId: string;
  type: string;
  title: string;
  message: string;
  issuedByAdminId?: string;
  issuedByAdminUsername?: string;
}) {
  return await mainDb
    .insertInto('user_notifications')
    .values({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      read: false,
      created_at: sql`now()`,
      issued_by_admin_id: input.issuedByAdminId ?? null,
      issued_by_admin_username: input.issuedByAdminUsername ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** Every notification ever sent, joined with the recipient, for the admin view. */
export async function getAllUserNotificationsForAdmin(
  page = 1,
  limit = 50,
  search = ''
) {
  const offset = (page - 1) * limit;
  const trimmedSearch = search.trim();

  let base = mainDb
    .selectFrom('user_notifications')
    .innerJoin('users', 'users.id', 'user_notifications.user_id');

  if (trimmedSearch) {
    base = base.where((eb) =>
      eb.or([
        eb('users.username', 'ilike', `%${trimmedSearch}%`),
        eb('user_notifications.title', 'ilike', `%${trimmedSearch}%`),
        eb('user_notifications.message', 'ilike', `%${trimmedSearch}%`),
      ])
    );
  }

  const totalResult = await base
    .select(({ fn }) => fn.count('user_notifications.id').as('count'))
    .executeTakeFirst();
  const total = Number(totalResult?.count ?? 0);

  const alerts = await base
    .select([
      'user_notifications.id',
      'user_notifications.user_id',
      'users.username',
      'users.avatar',
      'user_notifications.type',
      'user_notifications.title',
      'user_notifications.message',
      'user_notifications.read',
      'user_notifications.created_at',
      'user_notifications.issued_by_admin_id',
      'user_notifications.issued_by_admin_username',
    ])
    .orderBy('user_notifications.created_at', 'desc')
    .orderBy('user_notifications.id', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();

  return {
    alerts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getUserNotifications(
  userId: string,
  unreadOnly = false,
  limit = 20
) {
  let query = mainDb
    .selectFrom('user_notifications')
    .selectAll()
    .where('user_id', '=', userId);

  if (unreadOnly) {
    query = query.where('read', '=', false);
  }

  return await query.orderBy('created_at', 'desc').limit(limit).execute();
}

export async function markNotificationAsRead(
  notificationId: number,
  userId: string
) {
  const result = await mainDb
    .updateTable('user_notifications')
    .set({ read: true })
    .where('id', '=', notificationId)
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirst();

  return result;
}

export async function markAllNotificationsAsRead(userId: string) {
  await mainDb
    .updateTable('user_notifications')
    .set({ read: true })
    .where('user_id', '=', userId)
    .execute();
}

export async function deleteNotification(
  notificationId: number,
  userId: string
) {
  await mainDb
    .deleteFrom('user_notifications')
    .where('id', '=', notificationId)
    .where('user_id', '=', userId)
    .execute();
}
