import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import {
  getApiLogs,
  getApiLogById,
  getApiLogStats,
  getApiLogStatsLast24Hours,
} from '../../db/apiLogs.js';

const router = express.Router();

router.use(requirePermission('audit'));

// GET: /api/admin/api-logs - Get API logs
router.get(
  '/',
  createAuditLogger('ADMIN_API_LOGS_ACCESSED'),
  async (req, res) => {
    try {
      const pageParam = req.query.page;
      const limitParam = req.query.limit;
      const userIdParam = req.query.userId;
      const methodParam = req.query.method;
      const pathParam = req.query.path;
      const statusCodeParam = req.query.statusCode;
      const dateFromParam = req.query.dateFrom;
      const dateToParam = req.query.dateTo;
      const searchParam = req.query.search;

      const page = typeof pageParam === 'string' ? parseInt(pageParam) : 1;
      const limit = typeof limitParam === 'string' ? parseInt(limitParam) : 50;
      const userId = typeof userIdParam === 'string' ? userIdParam : undefined;
      const method = typeof methodParam === 'string' ? methodParam : undefined;
      const path = typeof pathParam === 'string' ? pathParam : undefined;
      const statusCode =
        typeof statusCodeParam === 'string'
          ? parseInt(statusCodeParam)
          : undefined;
      const dateFrom =
        typeof dateFromParam === 'string' ? dateFromParam : undefined;
      const dateTo = typeof dateToParam === 'string' ? dateToParam : undefined;
      const search = typeof searchParam === 'string' ? searchParam : undefined;

      const data = await getApiLogs(page, limit, {
        userId,
        method,
        path,
        statusCode,
        dateFrom,
        dateTo,
        search,
      });

      res.json(data);
    } catch (error) {
      console.error('Error fetching API logs:', error);
      res.status(500).json({ error: 'Failed to fetch API logs' });
    }
  }
);

// GET: /api/admin/api-logs/stats - Get API logs statistics
router.get(
  '/stats',
  createAuditLogger('ADMIN_API_LOGS_STATS_ACCESSED'),
  async (req, res) => {
    try {
      const daysParam = req.query.days;
      const days = typeof daysParam === 'string' ? parseInt(daysParam) : 7;

      const stats = await getApiLogStats(days);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching API logs stats:', error);
      res.status(500).json({ error: 'Failed to fetch API logs statistics' });
    }
  }
);

// GET: /api/admin/api-logs/stats-24h - Get API logs statistics for the last 24 hours
router.get(
  '/stats-24h',
  createAuditLogger('ADMIN_API_LOGS_STATS_24H_ACCESSED'),
  async (req, res) => {
    try {
      const stats = await getApiLogStatsLast24Hours();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching API logs stats for last 24 hours:', error);
      res.status(500).json({
        error: 'Failed to fetch API logs statistics for last 24 hours',
      });
    }
  }
);

// GET: /api/admin/api-logs/:id - Get specific API log
router.get(
  '/:id',
  createAuditLogger('ADMIN_API_LOG_VIEWED'),
  async (req, res) => {
    try {
      const logId = parseInt(req.params.id);

      if (isNaN(logId)) {
        return res.status(400).json({ error: 'Invalid log ID' });
      }

      const log = await getApiLogById(logId);

      if (!log) {
        return res.status(404).json({ error: 'API log not found' });
      }

      res.json(log);
    } catch (error) {
      console.error('Error fetching API log:', error);
      res.status(500).json({ error: 'Failed to fetch API log' });
    }
  }
);

export default router;
