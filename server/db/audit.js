import pool from './connections/connection.js';
import { encrypt, decrypt } from '../tools/encryption.js';

async function initializeAuditTable() {
    try {
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'audit_log'
            )
        `);
        const exists = result.rows[0].exists;

        if (!exists) {
            await pool.query(`
                CREATE TABLE audit_log (
                    id SERIAL PRIMARY KEY,
                    admin_id VARCHAR(20) NOT NULL,
                    admin_username VARCHAR(32) NOT NULL,
                    action_type VARCHAR(50) NOT NULL,
                    target_user_id VARCHAR(20),
                    target_username VARCHAR(32),
                    details JSONB,
                    ip_address TEXT,
                    user_agent TEXT,
                    timestamp TIMESTAMP DEFAULT NOW(),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id ON audit_log(admin_id);
                CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
                CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON audit_log(action_type);
                CREATE INDEX IF NOT EXISTS idx_audit_log_target_user_id ON audit_log(target_user_id);
            `);
        } else {
            const columns = await pool.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'audit_log'
                ORDER BY ordinal_position
            `);
        }
    } catch (error) {
        console.error('Error initializing audit log table:', error);
        console.error('Error stack:', error.stack);
    }
}

export async function logAdminAction(actionData) {
    const {
        adminId,
        adminUsername,
        actionType,
        targetUserId = null,
        targetUsername = null,
        details = {},
        ipAddress = null,
        userAgent = null
    } = actionData;

    try {
        const encryptedIP = ipAddress ? encrypt(ipAddress) : null;

        const result = await pool.query(`
            INSERT INTO audit_log (
                admin_id, admin_username, action_type, target_user_id,
                target_username, details, ip_address, user_agent
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, timestamp
        `, [
            adminId,
            adminUsername,
            actionType,
            targetUserId,
            targetUsername,
            JSON.stringify(details),
            encryptedIP ? JSON.stringify(encryptedIP) : null,
            userAgent
        ]);

        return result.rows[0].id;
    } catch (error) {
        console.error('Error logging admin action:', error);
        throw error;
    }
}

export async function getAuditLogs(page = 1, limit = 50, filters = {}) {
    try {
        const offset = (page - 1) * limit;
        let query = `
            SELECT
                id, admin_id, admin_username, action_type, target_user_id,
                target_username, details, ip_address, user_agent, timestamp
            FROM audit_log
        `;

        const conditions = [];
        const values = [];
        let paramCount = 1;

        if (filters.adminId) {
            conditions.push(`(admin_id ILIKE $${paramCount} OR admin_username ILIKE $${paramCount})`);
            values.push(`%${filters.adminId}%`);
            paramCount++;
        }

        if (filters.actionType) {
            conditions.push(`action_type = $${paramCount++}`);
            values.push(filters.actionType);
        }

        if (filters.targetUserId) {
            conditions.push(`(target_user_id ILIKE $${paramCount} OR target_username ILIKE $${paramCount})`);
            values.push(`%${filters.targetUserId}%`);
            paramCount++;
        }

        if (filters.dateFrom) {
            conditions.push(`timestamp >= $${paramCount++}`);
            values.push(filters.dateFrom);
        }

        if (filters.dateTo) {
            conditions.push(`timestamp <= $${paramCount++}`);
            values.push(filters.dateTo);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY timestamp DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        const logs = result.rows.map(log => {
            let decryptedIP = null;
            if (log.ip_address) {
                try {
                    const parsed = JSON.parse(log.ip_address);
                    decryptedIP = decrypt(parsed);
                } catch (error) {
                    console.warn(`Failed to parse/decrypt ip_address for audit log ${log.id}:`, error.message);
                    decryptedIP = decrypt(log.ip_address);
                }
            }
            return {
                ...log,
                ip_address: decryptedIP,
                details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
            };
        });

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) FROM audit_log';
        const countValues = [];

        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.join(' AND ');
            // Add the same filter values except limit and offset
            for (let i = 0; i < values.length - 2; i++) {
                countValues.push(values[i]);
            }
        }

        const countResult = await pool.query(countQuery, countValues);
        const totalLogs = parseInt(countResult.rows[0].count);

        return {
            logs,
            pagination: {
                page,
                limit,
                total: totalLogs,
                pages: Math.ceil(totalLogs / limit)
            }
        };
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

export async function getAuditLogById(logId) {
    try {
        const result = await pool.query(`
            SELECT
                id, admin_id, admin_username, action_type, target_user_id,
                target_username, details, ip_address, user_agent, timestamp
            FROM audit_log
            WHERE id = $1
        `, [logId]);

        if (result.rows.length === 0) {
            return null;
        }

        const log = result.rows[0];
        let decryptedIP = null;
        if (log.ip_address) {
            try {
                const parsed = JSON.parse(log.ip_address);
                decryptedIP = decrypt(parsed);
            } catch (error) {
                console.warn(`Failed to parse/decrypt ip_address for audit log ${logId}:`, error.message);
                decryptedIP = decrypt(log.ip_address);
            }
        }

        return {
            ...log,
            ip_address: decryptedIP,
            details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
        };
    } catch (error) {
        console.error('Error fetching audit log by ID:', error);
        throw error;
    }
}

export async function cleanupOldAuditLogs(daysToKeep = 14) {
    try {
        const result = await pool.query(`
            DELETE FROM audit_log
            WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'
        `);

        const deletedCount = result.rowCount;
        return deletedCount;
    } catch (error) {
        console.error('Error cleaning up audit logs:', error);
        throw error;
    }
}

// Automatic cleanup scheduler
let cleanupInterval = null;

function startAutomaticCleanup() {
    // Run cleanup every 12 hours (12 * 60 * 60 * 1000 ms)
    const CLEANUP_INTERVAL = 12 * 60 * 60 * 1000;

    // Run initial cleanup after 1 minute
    setTimeout(async () => {
        try {
            await cleanupOldAuditLogs(14);
        } catch (error) {
            console.error('Initial audit log cleanup failed:', error);
        }
    }, 60 * 1000);

    // Set up recurring cleanup
    cleanupInterval = setInterval(async () => {
        try {
            await cleanupOldAuditLogs(14);
        } catch (error) {
            console.error('Scheduled audit log cleanup failed:', error);
        }
    }, CLEANUP_INTERVAL);
}

function stopAutomaticCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}

// Initialize the table and start cleanup when the module is imported
initializeAuditTable().then(() => {
    startAutomaticCleanup();
});

export { initializeAuditTable, startAutomaticCleanup, stopAutomaticCleanup };