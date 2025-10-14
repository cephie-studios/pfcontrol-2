import { mainDb } from "./connection";

export async function getUserNotifications(userId: string, unreadOnly = false, limit = 20) {
  let query = mainDb
    .selectFrom('user_notifications')
    .selectAll()
    .where('user_id', '=', userId);

  if (unreadOnly) {
    query = query.where('read', '=', false);
  }

  return await query
    .orderBy('created_at', 'desc')
    .limit(limit)
    .execute();
}

export async function markNotificationAsRead(notificationId: number, userId: string) {
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

export async function deleteNotification(notificationId: number, userId: string) {
  await mainDb
    .deleteFrom('user_notifications')
    .where('id', '=', notificationId)
    .where('user_id', '=', userId)
    .execute();
}