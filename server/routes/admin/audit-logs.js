import express from 'express';
import { createAuditLogger, logIPAccess } from '../../middleware/auditLogger.js';
import { getAuditLogs, getAuditLogById } from '../../db/audit.js';

const router = express.Router();

// GET: /api/admin/audit-logs - Get audit logs
router.get('/', createAuditLogger('ADMIN_AUDIT_LOGS_ACCESSED'), async (req, res) => {
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
                    ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
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