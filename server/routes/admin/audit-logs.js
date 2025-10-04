import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { getAuditLogs } from '../../db/audit.js';

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

export default router;