import pool from './connections/connection.js';
import flightsPool from './connections/flightsConnection.js';
import { getAllSessions } from './sessions.js';
import { cleanupOldStatistics } from './statistics.js';
import { isAdmin } from '../middleware/isAdmin.js';
import { decrypt } from '../tools/encryption.js';

export async function getDailyStatistics(days = 30) {
    try {
        await cleanupOldStatistics();

        const result = await pool.query(`
            SELECT
                date,
                COALESCE(logins_count, 0) as logins_count,
                COALESCE(new_sessions_count, 0) as new_sessions_count,
                COALESCE(new_flights_count, 0) as new_flights_count,
                COALESCE(new_users_count, 0) as new_users_count
            FROM daily_statistics
            WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
            ORDER BY date ASC
        `);

        if (result.rows.length === 0) {
            await backfillStatistics();
            return getDailyStatistics(days);
        }

        return result.rows;
    } catch (error) {
        console.error('Error fetching daily statistics:', error);
        return [];
    }
}

export async function getTotalStatistics() {
    try {
        const dailyResult = await pool.query(`
            SELECT
                COALESCE(SUM(logins_count), 0) as total_logins,
                COALESCE(SUM(new_sessions_count), 0) as total_sessions,
                COALESCE(SUM(new_flights_count), 0) as total_flights,
                COALESCE(SUM(new_users_count), 0) as total_users
            FROM daily_statistics
        `);

        const stats = dailyResult.rows[0];
        if (stats.total_users === 0) {
            const directStats = await calculateDirectStatistics();
            return directStats;
        }

        return stats;
    } catch (error) {
        console.error('Error fetching total statistics:', error);
        return {
            total_logins: 0,
            total_sessions: 0,
            total_flights: 0,
            total_users: 0
        };
    }
}

async function calculateDirectStatistics() {
    try {
        const usersResult = await pool.query('SELECT COUNT(*) FROM users');
        const sessionsResult = await pool.query('SELECT COUNT(*) FROM sessions');

        const sessions = await getAllSessions();
        let totalFlights = 0;

        for (const session of sessions) {
            try {
                const flightResult = await flightsPool.query(
                    `SELECT COUNT(*) FROM flights_${session.session_id}`
                );
                totalFlights += parseInt(flightResult.rows[0].count, 10);
            } catch (error) {
                console.warn(`Could not count flights for session ${session.session_id}`);
            }
        }

        return {
            total_logins: 0,
            total_sessions: parseInt(sessionsResult.rows[0].count, 10),
            total_flights: totalFlights,
            total_users: parseInt(usersResult.rows[0].count, 10)
        };
    } catch (error) {
        console.error('Error calculating direct statistics:', error);
        return {
            total_logins: 0,
            total_sessions: 0,
            total_flights: 0,
            total_users: 0
        };
    }
}

async function backfillStatistics() {
    try {
        const directStats = await calculateDirectStatistics();

        const today = new Date().toISOString().split('T')[0];

        await pool.query(`
            INSERT INTO daily_statistics (
                date,
                logins_count,
                new_sessions_count,
                new_flights_count,
                new_users_count
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (date) DO UPDATE SET
                new_sessions_count = EXCLUDED.new_sessions_count,
                new_flights_count = EXCLUDED.new_flights_count,
                new_users_count = EXCLUDED.new_users_count,
                updated_at = NOW()
        `, [
            today,
            0,
            directStats.total_sessions,
            directStats.total_flights,
            directStats.total_users
        ]);

        console.log('Statistics backfilled successfully');
    } catch (error) {
        console.error('Error backfilling statistics:', error);
    }
}

export async function getAllUsers(page = 1, limit = 50) {
    try {
        const offset = (page - 1) * limit;

        const result = await pool.query(`
            SELECT
                id, username, discriminator, avatar, last_login,
                ip_address, is_vpn, total_sessions_created,
                total_minutes, created_at, settings
            FROM users
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await pool.query('SELECT COUNT(*) FROM users');
        const totalUsers = parseInt(countResult.rows[0].count);

        // Add is_admin field and decrypt settings for each user
        const usersWithAdminStatus = result.rows.map(user => {
            let decryptedSettings = null;
            try {
                if (user.settings) {
                    decryptedSettings = decrypt(JSON.parse(user.settings));
                }
            } catch (error) {
                console.warn(`Failed to decrypt settings for user ${user.id}`);
            }

            return {
                ...user,
                is_admin: isAdmin(user.id),
                settings: decryptedSettings
            };
        });

        return {
            users: usersWithAdminStatus,
            pagination: {
                page,
                limit,
                total: totalUsers,
                pages: Math.ceil(totalUsers / limit)
            }
        };
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

export async function getSystemInfo() {
    try {
        const dbStats = await pool.query(`
            SELECT
                schemaname,
                tablename,
                COALESCE(n_tup_ins, 0) as inserts,
                COALESCE(n_tup_upd, 0) as updates,
                COALESCE(n_tup_del, 0) as deletes
            FROM pg_stat_user_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);

        return {
            database: dbStats.rows,
            server: {
                nodeVersion: process.version,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                platform: process.platform
            }
        };
    } catch (error) {
        console.error('Error fetching system info:', error);
        throw error;
    }
}

export async function getAdminSessions() {
    try {
        const sessions = await getAllSessions();

        const sessionsWithFlights = await Promise.all(
            sessions.map(async (session) => {
                try {
                    const flightResult = await flightsPool.query(
                        `SELECT COUNT(*) FROM flights_${session.session_id}`
                    );
                    return {
                        ...session,
                        flight_count: parseInt(flightResult.rows[0].count, 10)
                    };
                } catch (error) {
                    return {
                        ...session,
                        flight_count: 0
                    };
                }
            })
        );

        return sessionsWithFlights;
    } catch (error) {
        console.error('Error fetching admin sessions:', error);
        throw error;
    }
}