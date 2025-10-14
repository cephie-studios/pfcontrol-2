import pool from './connections/connection.js';

async function initializeTestersTable() {
    try {
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'testers'
            )
        `);
        const exists = result.rows[0].exists;

        if (!exists) {
            await pool.query(`
                CREATE TABLE testers (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL UNIQUE,
                    username VARCHAR(32) NOT NULL,
                    added_by VARCHAR(20) NOT NULL,
                    added_by_username VARCHAR(32) NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            console.log('Testers table created successfully');
        }
    } catch (error) {
        console.error('Error initializing testers table:', error);
    }
}

export async function addTester(userId, username, addedBy, addedByUsername, notes = '') {
    try {
        const result = await pool.query(`
            INSERT INTO testers (user_id, username, added_by, added_by_username, notes)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                username = EXCLUDED.username,
                notes = EXCLUDED.notes,
                updated_at = NOW()
            RETURNING *
        `, [userId, username, addedBy, addedByUsername, notes]);

        return result.rows[0];
    } catch (error) {
        console.error('Error adding tester:', error);
        throw error;
    }
}

export async function removeTester(userId) {
    try {
        const result = await pool.query(`
            DELETE FROM testers WHERE user_id = $1 RETURNING *
        `, [userId]);

        return result.rows[0];
    } catch (error) {
        console.error('Error removing tester:', error);
        throw error;
    }
}

export async function isTester(userId) {
    try {
        const result = await pool.query(`
            SELECT 1 FROM testers WHERE user_id = $1
        `, [userId]);

        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking tester status:', error);
        return false;
    }
}

export async function getAllTesters(page = 1, limit = 50, search = '') {
    try {
        const offset = (page - 1) * limit;

        let whereClause = '';
        let queryParams = [];

        if (search && search.trim()) {
            whereClause = 'WHERE t.username ILIKE $1 OR t.user_id = $2';
            queryParams = [`%${search.trim()}%`, search.trim()];
        }

        const result = await pool.query(`
            SELECT t.*, u.avatar
            FROM testers t
            LEFT JOIN users u ON t.user_id = u.id
            ${whereClause}
            ORDER BY t.created_at DESC
            LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `, [...queryParams, limit, offset]);

        const countResult = await pool.query(`
            SELECT COUNT(*) FROM testers t ${whereClause.replace('t.username', 'username').replace('t.user_id', 'user_id')}
        `, queryParams);

        const total = parseInt(countResult.rows[0].count);

        return {
            testers: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error('Error fetching testers:', error);
        throw error;
    }
}

export async function getTesterSettings() {
    try {
        // Check if a settings table exists or use a simple approach
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'tester_settings'
            )
        `);

        if (!result.rows[0].exists) {
            await pool.query(`
                CREATE TABLE tester_settings (
                    id SERIAL PRIMARY KEY,
                    setting_key VARCHAR(50) UNIQUE NOT NULL,
                    setting_value BOOLEAN DEFAULT true,
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Insert default setting
            await pool.query(`
                INSERT INTO tester_settings (setting_key, setting_value)
                VALUES ('tester_gate_enabled', true)
                ON CONFLICT (setting_key) DO NOTHING
            `);
        }

        const settingsResult = await pool.query(`
            SELECT setting_key, setting_value FROM tester_settings
        `);

        const settings = {};
        settingsResult.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        return settings;
    } catch (error) {
        console.error('Error fetching tester settings:', error);
        return { tester_gate_enabled: true };
    }
}

export async function updateTesterSetting(key, value) {
    try {
        await pool.query(`
            INSERT INTO tester_settings (setting_key, setting_value, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (setting_key) DO UPDATE SET
                setting_value = EXCLUDED.setting_value,
                updated_at = NOW()
        `, [key, value]);

        return { [key]: value };
    } catch (error) {
        console.error('Error updating tester setting:', error);
        throw error;
    }
}

initializeTestersTable();

export { initializeTestersTable };