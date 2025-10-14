import { mainDb } from "./connection.js";
import { sql } from "kysely";

export async function getAllNotifications() {
  try {
    const notifications = await mainDb
      .selectFrom('notifications')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();
    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
}

export async function getActiveNotifications() {
  try {
    const notifications = await mainDb
      .selectFrom('notifications')
      .selectAll()
      .where('show', '=', true)
      .orderBy('created_at', 'desc')
      .execute();
    return notifications;
  } catch (error) {
    console.error('Error fetching active notifications:', error);
    throw error;
  }
}

export async function addNotification({
  type,
  text,
  show = false,
  customColor = undefined,
}: {
  type: string;
  text: string;
  show?: boolean;
  customColor?: string;
}) {
  try {
    const [notification] = await mainDb
      .insertInto('notifications')
      .values({
        id: sql`DEFAULT`,
        type,
        text,
        show,
        custom_color: customColor,
      })
      .returningAll()
      .execute();
    return notification;
  } catch (error) {
    console.error('Error adding notification:', error);
    throw error;
  }
}

export async function updateNotification(id: number, { type, text, show, customColor }: { type?: string, text?: string, show?: boolean, customColor?: string | null }) {
  try {
    const updateData: { type?: string; text?: string; show?: boolean; custom_color?: string; updated_at?: Date } = {};
    if (type !== undefined) updateData.type = type;
    if (text !== undefined) updateData.text = text;
    if (show !== undefined) updateData.show = show;
    if (customColor !== undefined) {
      if (customColor === null) {
        updateData.custom_color = undefined;
      } else {
        updateData.custom_color = customColor;
      }
    }
    updateData.updated_at = new Date();

    if (Object.keys(updateData).length === 0) {
      throw new Error('No fields provided for update');
    }

    const [notification] = await mainDb
      .updateTable('notifications')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .execute();

    if (!notification) {
      throw new Error('Notification not found');
    }
    return notification;
  } catch (error) {
    console.error('Error updating notification:', error);
    throw error;
  }
}

export async function deleteNotification(id: number) {
  try {
    const [notification] = await mainDb
      .deleteFrom('notifications')
      .where('id', '=', id)
      .returningAll()
      .execute();
    return notification;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}
