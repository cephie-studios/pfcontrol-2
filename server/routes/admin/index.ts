import express from 'express';
import requireAuth from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { getDailyStatistics, getTotalStatistics } from '../../db/admin.js';
import { getAppVersion } from '../../db/version.js';

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
import ratingsRouter from './ratings.js';
import altsRouter from './alts.js';
import developersRouter from './developers.js';
import websocketsRouter from './websockets.js';
import databaseRouter from './database.js';

const router = express.Router();

router.use(requireAuth);

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
router.use('/ratings', ratingsRouter);
router.use('/alts', altsRouter);
router.use('/developers', developersRouter);
router.use('/websockets', websocketsRouter);
router.use('/database', databaseRouter);

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
      totals: totalStats,
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

export default router;
