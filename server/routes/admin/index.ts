import express from 'express';
import requireAuth from '../../middleware/auth.js';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { getDailyStatistics, getTotalStatistics } from '../../db/admin.js';
import { getAppVersion, updateAppVersion } from '../../db/version.js';
import {
  getGlobalHolidaySettings,
  updateGlobalHolidaySettings,
} from '../../db/globalHolidaySettings.js';
import { redisConnection } from '../../db/connection.js';

import usersRouter from './users.js';
import sessionsRouter from './sessions.js';
import auditLogsRouter from './audit-logs.js';
import bansRouter from './ban.js';
import testersRouter from './testers.js';
import notificationRouter from './notifications.js';
import rolesRouter from './roles.js';
import chatReportsRouter from './chat-reports.js';
import updateModalsRouter from './updateModals.js';
import flightLogsRouter from './flight-logs.js';
import feedbackRouter from './feedback.js';
import apiLogsRouter from './api-logs.js';

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
router.use('/chat-reports', chatReportsRouter);
router.use('/update-modals', updateModalsRouter);
router.use('/flight-logs', flightLogsRouter);
router.use('/feedback', feedbackRouter);
router.use('/api-logs', apiLogsRouter);

// GET: /api/admin/statistics - Get dashboard statistics
router.get('/statistics', requirePermission('admin'), async (req, res) => {
    try {
        const daysParam = req.query.days;
        const days =
            typeof daysParam === 'string'
                ? parseInt(daysParam)
                : Array.isArray(daysParam) && typeof daysParam[0] === 'string'
                ? parseInt(daysParam[0])
                : 30;
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

        const updatedVersion = await updateAppVersion(version.trim(), req.user?.username || 'Unknown Admin');
        
        const cacheKey = 'app:version';
        try {
            await redisConnection.del(cacheKey);
            await redisConnection.set(cacheKey, JSON.stringify(updatedVersion), 'EX', 86400);
        } catch (error) {
            if (error instanceof Error) {
                console.warn('[Redis] Failed to update cache for app version:', error.message);
            }
        }

        res.json(updatedVersion);
    } catch (error) {
        console.error('Error updating app version:', error);
        res.status(500).json({ error: 'Failed to update app version' });
    }
});

// GET /api/admin/holiday-settings
// Get global holiday settings
router.get('/holiday-settings', requirePermission('admin'), async (req, res) => {
  try {
    const settings = await getGlobalHolidaySettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching global holiday settings:', error);
    res.status(500).json({
      error: 'Failed to fetch global holiday settings',
    });
  }
});

// PUT /api/admin/holiday-settings
// Update global holiday settings
router.put(
  '/holiday-settings',
  requirePermission('admin'),
  createAuditLogger('ADMIN_HOLIDAY_SETTINGS_UPDATED'),
  async (req, res) => {
    try {
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid request body. Expected { enabled: boolean }',
        });
      }

      const userId = req.user?.userId || 'unknown';
      const updated = await updateGlobalHolidaySettings(enabled, userId);

      res.json(updated);
    } catch (error) {
      console.error('Error updating global holiday settings:', error);
      res.status(500).json({
        error: 'Failed to update global holiday settings',
      });
    }
  }
);

export default router;