import express from 'express';
import requireAuth from '../middleware/isAuthenticated.js';
import { requireAdmin } from '../middleware/isAdmin.js';
import {
    getDailyStatistics,
    getTotalStatistics,
    getAllUsers,
    getSystemInfo,
    getAdminSessions
} from '../db/admin.js';
import { getAuditLogs } from '../db/audit.js';
import { createAuditLogger, logIPAccess } from '../middleware/auditLogger.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

// GET: /api/admin/statistics - Get dashboard statistics
router.get('/statistics', createAuditLogger('ADMIN_DASHBOARD_ACCESSED'), async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const dailyStats = await getDailyStatistics(days);
        const totalStats = await getTotalStatistics();

        res.json({
            daily: dailyStats,
            totals: totalStats
        });
    } catch (error) {
        console.error('Error fetching admin statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// GET: /api/admin/users - Get all users with pagination
router.get('/users', createAuditLogger('ADMIN_USERS_ACCESSED'), async (req, res) => {
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
router.post('/users/:userId/reveal-ip', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await getAllUsers(1, 1000);
        const user = result.users.find(u => u.id === userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Log the IP access action
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
                // Don't fail the request if audit logging fails
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

// GET: /api/admin/sessions - Get all sessions with details
router.get('/sessions', createAuditLogger('ADMIN_SESSIONS_ACCESSED'), async (req, res) => {
    try {
        const sessions = await getAdminSessions();
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// GET: /api/admin/system-info - Get system information
router.get('/system-info', createAuditLogger('ADMIN_SYSTEM_INFO_ACCESSED'), async (req, res) => {
    try {
        const systemInfo = await getSystemInfo();
        res.json(systemInfo);
    } catch (error) {
        console.error('Error fetching system info:', error);
        res.status(500).json({ error: 'Failed to fetch system information' });
    }
});

// GET: /api/admin/audit-logs - Get audit logs
router.get('/audit-logs', createAuditLogger('ADMIN_AUDIT_LOGS_ACCESSED'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const filters = {
            adminId: req.query.adminId,
            actionType: req.query.actionType,
            targetUserId: req.query.targetUserId,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo
        };

        const result = await getAuditLogs(page, limit, filters);
        res.json(result);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

export default router;