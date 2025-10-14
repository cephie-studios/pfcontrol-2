import express from 'express';
import { createAuditLogger, logIPAccess } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { getAuditLogs, getAuditLogById } from '../../db/audit.js';
import { getClientIp } from '../../utils/getIpAddress.js';

const router = express.Router();

router.use(requirePermission('audit'));

// GET: /api/admin/audit-logs - Get audit logs
router.get('/', createAuditLogger('ADMIN_AUDIT_LOGS_ACCESSED'), async (req, res) => {
    try {
        const pageParam = req.query.page;
        const limitParam = req.query.limit;
        const adminIdParam = req.query.adminId;
        const actionTypeParam = req.query.actionType;
        const targetUserIdParam = req.query.targetUserId;
        const dateFromParam = req.query.dateFrom;
        const dateToParam = req.query.dateTo;

        const page =
            typeof pageParam === 'string'
                ? parseInt(pageParam)
                : Array.isArray(pageParam) && typeof pageParam[0] === 'string'
                ? parseInt(pageParam[0])
                : 1;
        const limit =
            typeof limitParam === 'string'
                ? parseInt(limitParam)
                : Array.isArray(limitParam) && typeof limitParam[0] === 'string'
                ? parseInt(limitParam[0])
                : 50;

        const filters = {
            adminId:
                typeof adminIdParam === 'string'
                    ? adminIdParam
                    : Array.isArray(adminIdParam) && typeof adminIdParam[0] === 'string'
                    ? adminIdParam[0]
                    : undefined,
            actionType:
                typeof actionTypeParam === 'string'
                    ? actionTypeParam
                    : Array.isArray(actionTypeParam) && typeof actionTypeParam[0] === 'string'
                    ? actionTypeParam[0]
                    : undefined,
            targetUserId:
                typeof targetUserIdParam === 'string'
                    ? targetUserIdParam
                    : Array.isArray(targetUserIdParam) && typeof targetUserIdParam[0] === 'string'
                    ? targetUserIdParam[0]
                    : undefined,
            dateFrom:
                typeof dateFromParam === 'string'
                    ? dateFromParam
                    : Array.isArray(dateFromParam) && typeof dateFromParam[0] === 'string'
                    ? dateFromParam[0]
                    : undefined,
            dateTo:
                typeof dateToParam === 'string'
                    ? dateToParam
                    : Array.isArray(dateToParam) && typeof dateToParam[0] === 'string'
                    ? dateToParam[0]
                    : undefined
        };

        const result = await getAuditLogs(page, limit, filters);
        res.json(result);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// POST: /api/admin/audit-logs/:logId/reveal-ip - Reveal audit log IP address
router.post('/:logId/reveal-ip', async (req, res) => {
    try {
        const { logId } = req.params;
        const log = await getAuditLogById(parseInt(logId));

        if (!log) {
            return res.status(404).json({ error: 'Audit log not found' });
        }

        if (req.user?.userId) {
            try {
                const auditData = {
                    adminId: req.user.userId,
                    adminUsername: req.user.username || 'Unknown',
                    actionType: 'AUDIT_LOG_IP_VIEWED',
                    targetUserId: log.admin_id,
                    targetUsername: log.admin_username,
                    ipAddress: (() => {
                        const ip = getClientIp(req);
                        if (Array.isArray(ip)) return ip[0] ?? null;
                        return ip ?? null;
                    })(),
                    userAgent: req.get('User-Agent'),
                    details: {
                        method: req.method,
                        url: req.originalUrl,
                        revealedIP: log.ip_address,
                        auditLogId: log.id,
                        timestamp: new Date().toISOString()
                    }
                };

                await logIPAccess(auditData);
            } catch (auditError) {
                console.error('Failed to log audit IP access:', auditError);
            }
        }

        res.json({
            logId: log.id,
            ip_address: log.ip_address
        });
    } catch (error) {
        console.error('Error revealing audit log IP address:', error);
        res.status(500).json({ error: 'Failed to reveal IP address' });
    }
});

export default router;