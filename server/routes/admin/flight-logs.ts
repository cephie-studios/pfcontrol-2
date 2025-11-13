import express, { Request, Response } from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { getFlightLogs, getFlightLogById } from '../../db/flightLogs.js';
import { logAdminAction } from '../../db/audit.js';
import { getClientIp } from '../../utils/getIpAddress.js';

const router = express.Router();

router.use(requirePermission('audit'));

// GET: /api/admin/flight-logs - Get flight logs
router.get('/', createAuditLogger('ADMIN_FLIGHT_LOGS_ACCESSED'), async (req, res) => {
    try {
        const pageParam = req.query.page;
        const limitParam = req.query.limit;
        const generalParam = req.query.general;
        const userParam = req.query.user;
        const actionParam = req.query.action;
        const sessionParam = req.query.session;
        const flightIdParam = req.query.flightId;
        const dateParam = req.query.date;
        const textParam = req.query.text;

        const page = typeof pageParam === 'string' ? parseInt(pageParam) : 1;
        const limit = typeof limitParam === 'string' ? parseInt(limitParam) : 50;
        const general = typeof generalParam === 'string' ? generalParam : undefined;
        const user = typeof userParam === 'string' ? userParam : undefined;
        const validActions = ["add", "update", "delete"] as const;
        const action = typeof actionParam === 'string' && validActions.includes(actionParam as typeof validActions[number]) ? actionParam as typeof validActions[number] : undefined;
        const session = typeof sessionParam === 'string' ? sessionParam : undefined;
        const flightId = typeof flightIdParam === 'string' ? flightIdParam : undefined;
        const date = typeof dateParam === 'string' ? dateParam : undefined;
        const text = typeof textParam === 'string' ? textParam : undefined;

        const data = await getFlightLogs(page, limit, { general, user, action, session, flightId, date, text });
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
router.post('/reveal-ip/:id', createAuditLogger('FLIGHT_LOG_IP_REVEALED'), async (req: Request, res: Response) => {
    try {
        const logId = req.params.id;
        const log = await getFlightLogById(logId);
        if (!log) {
            return res.status(404).json({ error: 'Flight log not found' });
        }

        // Log the IP access manually since logIPAccess middleware isn't working properly
        if (req.user?.userId) {
            try {
                const clientIp = getClientIp(req);
                await logAdminAction({
                    adminId: req.user.userId,
                    adminUsername: req.user.username || 'Unknown Admin',
                    actionType: 'FLIGHT_LOG_IP_REVEALED',
                    targetUserId: log.user_id,
                    targetUsername: log.username,
                    details: {
                        method: req.method,
                        url: req.originalUrl,
                        revealedIP: log.ip_address,
                        flightLogId: log.id,
                        timestamp: new Date().toISOString()
                    },
                    ipAddress: Array.isArray(clientIp) ? clientIp[0] : clientIp,
                    userAgent: req.get('User-Agent') || null
                });
            } catch (auditError) {
                console.error('Failed to log flight log IP access:', auditError);
            }
        }

        res.json({
            logId: log.id,
            ip_address: log.ip_address
        });
    } catch (error) {
        console.error('Error revealing flight log IP:', error);
        res.status(500).json({ error: 'Failed to reveal IP' });
    }
});

export default router;