import pool from './connections/connection.js';

export async function getAppVersion() {
    try {
        const result = await pool.query(`
            SELECT version, updated_at, updated_by
            FROM app_settings
            WHERE id = 1
        `);

        if (result.rows.length === 0) {
            await pool.query(`
                INSERT INTO app_settings (id, version, updated_at, updated_by)
                VALUES (1, '2.0.0.3', NOW(), 'system')
                ON CONFLICT (id) DO NOTHING
            `);

            return {
                version: '2.0.0.3',
                updated_at: new Date().toISOString(),
                updated_by: 'system'
            };
        }

        return result.rows[0];
    } catch (error) {
        console.error('Error getting app version:', error);
        throw error;
    }
}

export async function updateAppVersion(version, updatedBy) {
    try {
        const result = await pool.query(`
            INSERT INTO app_settings (id, version, updated_at, updated_by)
            VALUES (1, $1, NOW(), $2)
            ON CONFLICT (id) DO UPDATE SET
                version = EXCLUDED.version,
                updated_at = EXCLUDED.updated_at,
                updated_by = EXCLUDED.updated_by
            RETURNING version, updated_at, updated_by
        `, [version, updatedBy]);

        return result.rows[0];
    } catch (error) {
        console.error('Error updating app version:', error);
        throw error;
    }
}