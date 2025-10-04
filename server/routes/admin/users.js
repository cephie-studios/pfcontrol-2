import express from 'express';
import { createAuditLogger, logIPAccess } from '../../middleware/auditLogger.js';
import { getAllUsers } from '../../db/admin.js';

const router = express.Router();

// GET: /api/admin/users - Get all users with pagination
router.get('/', createAuditLogger('ADMIN_USERS_ACCESSED'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const result = await getAllUsers(page, limit);
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
        const result = await getAllUsers(1, 1000);
        const user = result.users.find(u => u.id === userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (req.user?.userId) {
            try {
                const auditData = {
                    adminId: req.user.userId,
                    adminUsername: req.user.username || 'Unknown',
                    actionType: 'IP_ADDRESS_VIEWED',
                    targetUserId: userId,
                    targetUsername: user.username,
                    ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    details: {
                        method: req.method,
                        url: req.originalUrl,
                        revealedIP: user.ip_address,
                        timestamp: new Date().toISOString()
                    }
                };

                await logIPAccess(auditData);
            } catch (auditError) {
                console.error('Failed to log IP access audit:', auditError);
            }
        }

        res.json({
            userId: user.id,
            username: user.username,
            ip_address: user.ip_address
        });
    } catch (error) {
        console.error('Error revealing IP address:', error);
        res.status(500).json({ error: 'Failed to reveal IP address' });
    }
});

export default router;