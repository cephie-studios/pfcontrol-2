import pool from './connections/connection.js';

export async function initializeBanTable() {
    try {
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'bans'
            )
        `);
        if (!result.rows[0].exists) {
            await pool.query(`
                CREATE TABLE bans (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(20),  -- Nullable for IP bans
                    ip_address VARCHAR(45),  -- New: Support IPv4/IPv6
                    username VARCHAR(32),
                    reason TEXT,
                    banned_by VARCHAR(20) NOT NULL,
                    banned_at TIMESTAMP DEFAULT NOW(),
                    expires_at TIMESTAMP,
                    active BOOLEAN DEFAULT true
                )
            `);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_bans_user_id ON bans(user_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_bans_ip_address ON bans(ip_address)`);
        }
    } catch (error) {
        console.error('Error initializing bans table:', error);
    }
}

export async function banUser({ userId, ip, username, reason, bannedBy, expiresAt }) {
    if (!userId && !ip) {
        throw new Error('Either userId or ip must be provided');
    }
    const expiresAtValue = expiresAt === '' ? null : expiresAt;
    await pool.query(
        `INSERT INTO bans (user_id, ip_address, username, reason, banned_by, expires_at, active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [userId || null, ip || null, username, reason, bannedBy, expiresAtValue]
    );
}

export async function unbanUser(userIdOrIp) {
    await pool.query(
        `UPDATE bans SET active = false WHERE (user_id = $1 OR ip_address = $1) AND active = true`,
        [userIdOrIp]
    );
}

export async function isUserBanned(userId) {
    const res = await pool.query(
        `SELECT * FROM bans WHERE user_id = $1 AND active = true AND (expires_at IS NULL OR expires_at > NOW())`,
        [userId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
}

export async function isIpBanned(ip) {
    const res = await pool.query(
        `SELECT * FROM bans WHERE ip_address = $1 AND active = true AND (expires_at IS NULL OR expires_at > NOW())`,
        [ip]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
}

export async function getAllBans(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const res = await pool.query(
        `SELECT * FROM bans ORDER BY banned_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    const countRes = await pool.query('SELECT COUNT(*) FROM bans');
    return {
        bans: res.rows,
        pagination: {
            page,
            limit,
            total: parseInt(countRes.rows[0].count),
            pages: Math.ceil(countRes.rows[0].count / limit)
        }
    };
}

initializeBanTable();