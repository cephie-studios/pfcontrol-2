import express from 'express';
import requireAuth from '../../middleware/isAuthenticated.js';
import { requireAdmin } from '../../middleware/isAdmin.js';

import statisticsRouter from './statistics.js';
import usersRouter from './users.js';
import sessionsRouter from './sessions.js';
import systemInfoRouter from './system-info.js';
import auditLogsRouter from './audit-logs.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.use('/statistics', statisticsRouter);
router.use('/users', usersRouter);
router.use('/sessions', sessionsRouter);
router.use('/system-info', systemInfoRouter);
router.use('/audit-logs', auditLogsRouter);

export default router;