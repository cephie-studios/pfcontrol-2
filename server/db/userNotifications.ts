import { mainDb } from './connection.js';

export async function createUserNotification(input: {
  userId: string;
  type: string;
  title: string;
  message: string;
}) {
  return await mainDb
    .insertInto('user_notifications')
    .values({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      read: false,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** Every notification ever sent, joined with the recipient, for the admin view. */
export async function getAllUserNotificationsForAdmin(limit = 200) {
  return await mainDb
    .selectFrom('user_notifications')
    .innerJoin('users', 'users.id', 'user_notifications.user_id')
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
    ])
    .orderBy('user_notifications.created_at', 'desc')
    .limit(limit)
    .execute();
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
