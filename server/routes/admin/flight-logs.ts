import express, { Request, Response } from 'express';
import { createAuditLogger, logIPAccess } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { getFlightLogs, getFlightLogById } from '../../db/flightLogs.js';

const router = express.Router();

router.use(requirePermission('audit'));

// GET: /api/admin/flight-logs - Get flight logs
router.get('/', createAuditLogger('ADMIN_FLIGHT_LOGS_ACCESSED'), async (req, res) => {
    try {
        const pageParam = req.query.page;
        const limitParam = req.query.limit;
        const userParam = req.query.user;
        const actionParam = req.query.action;
        const sessionParam = req.query.session;
        const flightIdParam = req.query.flightId;
        const dateFromParam = req.query.dateFrom;
        const dateToParam = req.query.dateTo;

        const page = typeof pageParam === 'string' ? parseInt(pageParam) : 1;
        const limit = typeof limitParam === 'string' ? parseInt(limitParam) : 50;
        const user = typeof userParam === 'string' ? userParam : undefined;
        const validActions = ["add", "update", "delete"] as const;
        const action = typeof actionParam === 'string' && validActions.includes(actionParam as typeof validActions[number]) ? actionParam as typeof validActions[number] : undefined;
        const session = typeof sessionParam === 'string' ? sessionParam : undefined;
        const flightId = typeof flightIdParam === 'string' ? flightIdParam : undefined;
        const dateFrom = typeof dateFromParam === 'string' ? dateFromParam : undefined;
        const dateTo = typeof dateToParam === 'string' ? dateToParam : undefined;

        const data = await getFlightLogs(page, limit, { user, action, session, flightId, dateFrom, dateTo });
        res.json(data);
    } catch (error) {
        console.error('Error fetching flight logs:', error);
        res.status(500).json({ error: 'Failed to fetch flight logs' });
    }
});

// GET: /api/admin/flight-logs/:id - Get specific flight log
router.get('/:id', createAuditLogger('ADMIN_FLIGHT_LOG_VIEWED'), async (req, res) => {
    try {
        const logId = req.params.id;
        const log = await getFlightLogById(logId);
        if (!log) {
            return res.status(404).json({ error: 'Flight log not found' });
        }
        res.json(log);
    } catch (error) {
        console.error('Error fetching flight log:', error);
        res.status(500).json({ error: 'Failed to fetch flight log' });
    }
});

// POST: /api/admin/flight-logs/reveal-ip/:id
router.post('/reveal-ip/:id', createAuditLogger('FLIGHT_LOG_IP_REVEALED'), logIPAccess, async (req: Request, res: Response) => {
    try {
        const logId = req.params.id;
        const log = await getFlightLogById(logId);
        if (!log) {
            return res.status(404).json({ error: 'Flight log not found' });
        }
        res.json({ ip_address: log.ip_address });
    } catch (error) {
        console.error('Error revealing flight log IP:', error);
        res.status(500).json({ error: 'Failed to reveal IP' });
    }
});

export default router;