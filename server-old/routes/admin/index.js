import express from 'express';
import requireAuth from '../../middleware/isAuthenticated.js';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { getDailyStatistics, getTotalStatistics, getSystemInfo } from '../../db/admin.js';
import { getAppVersion, updateAppVersion } from '../../db/version.js';

import usersRouter from './users.js';
import sessionsRouter from './sessions.js';
import auditLogsRouter from './audit-logs.js';
import bansRouter from './ban.js';
import testersRouter from './testers.js';
import notificationRouter from './notifications.js';
import rolesRouter from './roles.js';

const router = express.Router();

router.use(requireAuth);

// Heavy routes in separate files
router.use('/users', usersRouter);
router.use('/sessions', sessionsRouter);
router.use('/audit-logs', auditLogsRouter);
router.use('/bans', bansRouter);
router.use('/testers', testersRouter);
router.use('/notifications', notificationRouter);
router.use('/roles', rolesRouter);

// GET: /api/admin/statistics - Get dashboard statistics
router.get('/statistics', requirePermission('admin'), async (req, res) => {
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
router.get('/system-info', requirePermission('admin'), createAuditLogger('ADMIN_SYSTEM_INFO_ACCESSED'), async (req, res) => {
    try {
        const systemInfo = await getSystemInfo();
        res.json(systemInfo);
    } catch (error) {
        console.error('Error fetching system info:', error);
        res.status(500).json({ error: 'Failed to fetch system information' });
    }
});

// GET: /api/admin/version - Get app version (admin only)
router.get('/version', requirePermission('admin'), async (req, res) => {
    try {
        const version = await getAppVersion();
        res.json(version);
    } catch (error) {
        console.error('Error fetching app version:', error);
        res.status(500).json({ error: 'Failed to fetch app version' });
    }
});

// PUT: /api/admin/version - Update app version (admin only)
router.put('/version', requirePermission('admin'), createAuditLogger('ADMIN_VERSION_UPDATED'), async (req, res) => {
    try {
        const { version } = req.body;

        if (!version || typeof version !== 'string') {
            return res.status(400).json({ error: 'Version is required and must be a string' });
        }

        // Basic version validation
        const versionRegex = /^\d+\.\d+\.\d+(\.\d+)?$/;
        if (!versionRegex.test(version.trim())) {
            return res.status(400).json({ error: 'Invalid version format. Use MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH.BUILD' });
        }

        const updatedVersion = await updateAppVersion(version.trim(), req.user.id);
        res.json(updatedVersion);
    } catch (error) {
        console.error('Error updating app version:', error);
        res.status(500).json({ error: 'Failed to update app version' });
    }
});

export default router;