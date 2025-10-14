import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { banUser, unbanUser, getAllBans } from '../../db/ban.js';
import { logAdminAction } from '../../db/audit.js';
import { isAdmin } from '../../middleware/isAdmin.js';
import pool from '../../db/connections/connection.js';
import { getClientIp } from '../../tools/getIpAddress.js';

const router = express.Router();

router.use(requirePermission('bans'));

router.get('/', createAuditLogger('ADMIN_BANS_ACCESSED'), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await getAllBans(page, limit);
    res.json(result);
});

router.post('/ban', async (req, res) => {
    const { userId, ip, username, reason, expiresAt } = req.body;
    if (!userId && !ip) {
        return res.status(400).json({ error: 'Either userId or ip must be provided' });
    }
    if (userId && isAdmin(userId)) {
        return res.status(403).json({ error: 'Cannot ban a super admin' });
    }
    await banUser({
        userId,
        ip,
        username,
        reason,
        bannedBy: req.user.userId,
        expiresAt
    });

    await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'USER_BANNED',
        targetUserId: userId || null,
        targetUsername: ip || username || null,
        ipAddress: getClientIp(req),
        userAgent: req.get('User-Agent'),
        details: {
            reason,
            expiresAt,
            method: req.method,
            url: req.originalUrl,
            timestamp: new Date().toISOString()
        }
    });

    res.json({ success: true });
});

router.post('/unban', async (req, res) => {
    const { userIdOrIp } = req.body;

    const banRecord = await pool.query(
        `SELECT username FROM bans WHERE (user_id = $1 OR ip_address = $1) AND active = true LIMIT 1`,
        [userIdOrIp]
    );
    const username = banRecord.rows[0]?.username || userIdOrIp;

    await unbanUser(userIdOrIp);

    await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'USER_UNBANNED',
        targetUserId: null,
        targetUsername: username,
        ipAddress: getClientIp(req),
        userAgent: req.get('User-Agent'),
        details: {
            method: req.method,
            url: req.originalUrl,
            timestamp: new Date().toISOString()
        }
    });

    res.json({ success: true });
});

export default router;