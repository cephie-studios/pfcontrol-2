import pool from './connections/connection.js';
import flightsPool from './connections/flightsConnection.js';
import { getAllSessions } from './sessions.js';
import { cleanupOldStatistics } from './statistics.js';
import { isAdmin, getAdminIds } from '../middleware/isAdmin.js';
import { decrypt } from '../tools/encryption.js';
import { getActiveUsers } from '../websockets/sessionUsersWebsocket.js';

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

export async function getAllUsers(page = 1, limit = 50, search = '', filterAdmin = 'all') {
    try {
        const offset = (page - 1) * limit;

        // Build WHERE clause based on filters
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        // Search filter (username or ID)
        if (search && search.trim()) {
            whereConditions.push(`(username ILIKE $${paramIndex} OR id = $${paramIndex + 1})`);
            queryParams.push(`%${search.trim()}%`, search.trim());
            paramIndex += 2;
        }

        // Admin filter (at database level using admin IDs)
        if (filterAdmin === 'admin' || filterAdmin === 'non-admin') {
            const adminIds = getAdminIds();
            if (adminIds.length > 0) {
                const placeholders = adminIds.map((_, i) => `$${paramIndex + i}`).join(', ');
                if (filterAdmin === 'admin') {
                    whereConditions.push(`id IN (${placeholders})`);
                } else {
                    whereConditions.push(`id NOT IN (${placeholders})`);
                }
                queryParams.push(...adminIds);
                paramIndex += adminIds.length;
            } else if (filterAdmin === 'admin') {
                // No admins defined, return empty result
                return {
                    users: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                };
            }
        }

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const result = await pool.query(`
            SELECT
                id, username, discriminator, avatar, last_login,
                ip_address, is_vpn, total_sessions_created,
                total_minutes, created_at, settings
            FROM users
            ${whereClause}
            ORDER BY last_login DESC NULLS LAST
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...queryParams, limit, offset]);

        const countQuery = whereConditions.length > 0
            ? `SELECT COUNT(*) FROM users ${whereClause}`
            : 'SELECT COUNT(*) FROM users';

        const countResult = await pool.query(
            countQuery,
            whereConditions.length > 0 ? queryParams : []
        );
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
        const sessionsResult = await pool.query(`
            SELECT
                s.session_id,
                s.access_id,
                s.airport_icao,
                s.active_runway,
                (s.created_at AT TIME ZONE 'UTC') as created_at,
                s.created_by,
                s.is_pfatc,
                u.username,
                u.discriminator,
                u.avatar
            FROM sessions s
            LEFT JOIN users u ON s.created_by = u.id
            ORDER BY s.created_at DESC
        `);

        const activeUsers = getActiveUsers();

        const sessionsWithFlights = await Promise.all(
            sessionsResult.rows.map(async (session) => {
                try {
                    const flightResult = await flightsPool.query(
                        `SELECT COUNT(*) FROM flights_${session.session_id}`
                    );
                    const activeSessionUsers = activeUsers.get(session.session_id) || [];
                    return {
                        ...session,
                        flight_count: parseInt(flightResult.rows[0].count, 10),
                        active_users: activeSessionUsers,
                        active_user_count: activeSessionUsers.length
                    };
                } catch (error) {
                    const activeSessionUsers = activeUsers.get(session.session_id) || [];
                    return {
                        ...session,
                        flight_count: 0,
                        active_users: activeSessionUsers,
                        active_user_count: activeSessionUsers.length
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

export async function syncUserSessionCounts() {
    try {
        // Get all sessions grouped by user
        const result = await pool.query(`
            SELECT created_by, COUNT(*) as session_count
            FROM sessions
            GROUP BY created_by
        `);

        // Update each user's total_sessions_created
        for (const row of result.rows) {
            await pool.query(`
                UPDATE users
                SET total_sessions_created = $2
                WHERE id = $1
            `, [row.created_by, parseInt(row.session_count, 10)]);
        }

        // Set total_sessions_created to 0 for users with no sessions
        await pool.query(`
            UPDATE users
            SET total_sessions_created = 0
            WHERE id NOT IN (SELECT DISTINCT created_by FROM sessions)
        `);

        return { message: 'Session counts synced successfully', updatedUsers: result.rows.length };
    } catch (error) {
        console.error('Error syncing user session counts:', error);
        throw error;
    }
}