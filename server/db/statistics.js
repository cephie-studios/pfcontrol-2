import pool from './connections/connection.js';

let lastCleanupTime = 0;

async function initializeStatisticsTable() {
    try {
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'daily_statistics'
            )
        `);
        const exists = result.rows[0].exists;

        if (!exists) {
            await pool.query(`
                CREATE TABLE daily_statistics (
                    id SERIAL PRIMARY KEY,
                    date DATE UNIQUE NOT NULL,
                    logins_count INTEGER DEFAULT 0,
                    new_sessions_count INTEGER DEFAULT 0,
                    new_flights_count INTEGER DEFAULT 0,
                    new_users_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_daily_statistics_date ON daily_statistics(date)
            `);
        }
    } catch (error) {
        console.error('Error initializing statistics table:', error);
    }
}

export async function recordLogin() {
    try {
        const today = new Date().toISOString().split('T')[0];
        await pool.query(`
            INSERT INTO daily_statistics (date, logins_count)
            VALUES ($1, 1)
            ON CONFLICT (date) 
            DO UPDATE SET 
                logins_count = daily_statistics.logins_count + 1,
                updated_at = NOW()
        `, [today]);
    } catch (error) {
        console.error('Error recording login:', error);
    }
}

export async function recordNewSession() {
    try {
        const today = new Date().toISOString().split('T')[0];
        await pool.query(`
            INSERT INTO daily_statistics (date, new_sessions_count)
            VALUES ($1, 1)
            ON CONFLICT (date) 
            DO UPDATE SET 
                new_sessions_count = daily_statistics.new_sessions_count + 1,
                updated_at = NOW()
        `, [today]);
    } catch (error) {
        console.error('Error recording new session:', error);
    }
}

export async function recordNewFlight() {
    try {
        const today = new Date().toISOString().split('T')[0];
        await pool.query(`
            INSERT INTO daily_statistics (date, new_flights_count)
            VALUES ($1, 1)
            ON CONFLICT (date) 
            DO UPDATE SET 
                new_flights_count = daily_statistics.new_flights_count + 1,
                updated_at = NOW()
        `, [today]);
    } catch (error) {
        console.error('Error recording new flight:', error);
    }
}

export async function recordNewUser() {
    try {
        const today = new Date().toISOString().split('T')[0];
        await pool.query(`
            INSERT INTO daily_statistics (date, new_users_count)
            VALUES ($1, 1)
            ON CONFLICT (date) 
            DO UPDATE SET 
                new_users_count = daily_statistics.new_users_count + 1,
                updated_at = NOW()
        `, [today]);
    } catch (error) {
        console.error('Error recording new user:', error);
    }
}

export async function cleanupOldStatistics() {
    const now = Date.now();
    const twelveHoursInMs = 12 * 60 * 60 * 1000;

    if (now - lastCleanupTime < twelveHoursInMs) {
        return;
    }

    try {
        const result = await pool.query(`
            DELETE FROM daily_statistics
            WHERE date < CURRENT_DATE - INTERVAL '90 days'
        `);
        lastCleanupTime = now;
    } catch (error) {
        console.error('Error cleaning up old statistics:', error);
    }
}

initializeStatisticsTable();