import express from 'express';
import requireAuth from '../../middleware/isAuthenticated.js';
import { requireAdmin } from '../../middleware/isAdmin.js';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { getDailyStatistics, getTotalStatistics, getSystemInfo } from '../../db/admin.js';

import usersRouter from './users.js';
import sessionsRouter from './sessions.js';
import auditLogsRouter from './audit-logs.js';
import bansRouter from './ban.js';
import testersRouter from './testers.js';
import notificationRouter from './notifications.js';
import rolesRouter from './roles.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

// Heavy routes in separate files
router.use('/users', usersRouter);
router.use('/sessions', sessionsRouter);
router.use('/audit-logs', auditLogsRouter);
router.use('/bans', bansRouter);
router.use('/testers', testersRouter);
router.use('/notifications', notificationRouter);
router.use('/roles', rolesRouter);

// GET: /api/admin/statistics - Get dashboard statistics
router.get('/statistics', async (req, res) => {
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

export default router;