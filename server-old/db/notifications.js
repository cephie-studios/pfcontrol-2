import pool from './connections/connection.js';

async function initializeNotificationsTable() {
    try {
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'notifications'
            )
        `);
        const exists = result.rows[0].exists;

        if (!exists) {
            await pool.query(`
                CREATE TABLE notifications (
                    id SERIAL PRIMARY KEY,
                    type VARCHAR(20) NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error')),
                    text TEXT NOT NULL,
                    show BOOLEAN DEFAULT false,
                    custom_color VARCHAR(7), -- Hex color like #FFFFFF
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
        }
    } catch (error) {
        console.error('Error initializing notifications table:', error);
    }
}

export async function getAllNotifications() {
    try {
        const result = await pool.query(`
            SELECT * FROM notifications ORDER BY created_at DESC
        `);
        return result.rows;
    } catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }
}

export async function getActiveNotifications() {
    try {
        const result = await pool.query(`
            SELECT * FROM notifications WHERE show = true ORDER BY created_at DESC
        `);
        return result.rows;
    } catch (error) {
        console.error('Error fetching active notifications:', error);
        throw error;
    }
}

export async function addNotification({ type, text, show = false, customColor = null }) {
    try {
        const result = await pool.query(`
            INSERT INTO notifications (type, text, show, custom_color)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [type, text, show, customColor]);
        return result.rows[0];
    } catch (error) {
        console.error('Error adding notification:', error);
        throw error;
    }
}

export async function updateNotification(id, { type, text, show, customColor }) {
    try {
        let setClause = [];
        let values = [];
        let paramIndex = 1;

        if (type !== undefined) {
            setClause.push(`type = $${paramIndex++}`);
            values.push(type);
        }
        if (text !== undefined) {
            setClause.push(`text = $${paramIndex++}`);
            values.push(text);
        }
        if (show !== undefined) {
            setClause.push(`show = $${paramIndex++}`);
            values.push(show);
        }
        if (customColor !== undefined) {
            setClause.push(`custom_color = $${paramIndex++}`);
            values.push(customColor);
        }

        if (setClause.length === 0) {
            throw new Error('No fields provided for update');
        }

        setClause.push(`updated_at = NOW()`);
        const query = `
            UPDATE notifications
            SET ${setClause.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;
        values.push(id);

        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            throw new Error('Notification not found');
        }
        return result.rows[0];
    } catch (error) {
        console.error('Error updating notification:', error);
        throw error;
    }
}

export async function deleteNotification(id) {
    try {
        const result = await pool.query(`
            DELETE FROM notifications WHERE id = $1 RETURNING *
        `, [id]);
        return result.rows[0];
    } catch (error) {
        console.error('Error deleting notification:', error);
        throw error;
    }
}

initializeNotificationsTable();

export { initializeNotificationsTable };