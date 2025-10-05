import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { getAllUsers, syncUserSessionCounts } from '../../db/admin.js';
import { getUserById } from '../../db/users.js';
import { logAdminAction } from '../../db/audit.js';

const router = express.Router();

// GET: /api/admin/users - Get all users with pagination, search, and filters
router.get('/', createAuditLogger('ADMIN_USERS_ACCESSED'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const filterAdmin = req.query.filterAdmin || 'all';

        const result = await getAllUsers(page, limit, search, filterAdmin);
        res.json(result);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST: /api/admin/users/:userId/reveal-ip - Reveal user's IP address
router.post('/:userId/reveal-ip', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await getUserById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (req.user?.userId) {
            await logAdminAction({
                adminId: req.user.userId,
                adminUsername: req.user.username || 'Unknown',
                actionType: 'IP_REVEALED',
                targetUserId: userId,
                targetUsername: user.username,
                ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
                userAgent: req.get('User-Agent'),
                details: {
                    revealedIP: user.ipAddress,
                    timestamp: new Date().toISOString()
                }
            });
        }

        res.json({
            userId: user.id,
            username: user.username,
            ip_address: user.ipAddress
        });
    } catch (error) {
        console.error('Error revealing IP address:', error);
        res.status(500).json({ error: 'Failed to reveal IP address' });
    }
});

// POST: /api/admin/users/sync-session-counts - Sync session counts for all users
router.post('/sync-session-counts', createAuditLogger('ADMIN_SYNC_SESSION_COUNTS'), async (req, res) => {
    try {
        const result = await syncUserSessionCounts();
        res.json(result);
    } catch (error) {
        console.error('Error syncing session counts:', error);
        res.status(500).json({ error: 'Failed to sync session counts' });
    }
});

export default router;