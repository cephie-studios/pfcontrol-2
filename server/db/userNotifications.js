import pool from './connections/connection.js';

async function initializeUserNotificationsTable() {
  try {
    const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'user_notifications'
            )
        `);
    const exists = result.rows[0].exists;

    if (!exists) {
      await pool.query(`
                CREATE TABLE user_notifications (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    type VARCHAR(20) NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error')),
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    read BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

      await pool.query(`
                CREATE INDEX idx_user_notifications_user_id ON user_notifications(user_id)
            `);
    }
  } catch (error) {
    console.error('Error initializing user_notifications table:', error);
  }
}

export async function getUserNotifications(userId, unreadOnly = false) {
  try {
    let query = `
            SELECT * FROM user_notifications
            WHERE user_id = $1
        `;

    if (unreadOnly) {
      query += ` AND read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT 20`;

    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId, userId) {
  try {
    await pool.query(`
            UPDATE user_notifications
            SET read = true
            WHERE id = $1 AND user_id = $2
        `, [notificationId, userId]);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

export async function markAllNotificationsAsRead(userId) {
  try {
    await pool.query(`
            UPDATE user_notifications
            SET read = true
            WHERE user_id = $1 AND read = false
        `, [userId]);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

export async function deleteNotification(notificationId, userId) {
  try {
    await pool.query(`
            DELETE FROM user_notifications
            WHERE id = $1 AND user_id = $2
        `, [notificationId, userId]);
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

initializeUserNotificationsTable();

export { initializeUserNotificationsTable };
