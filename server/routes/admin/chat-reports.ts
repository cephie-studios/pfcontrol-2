import express from 'express';
import { mainDb } from '../../db/connection.js';
import requireAuth from '../../middleware/auth.js';
import { logAdminAction } from '../../db/audit.js';

const router = express.Router();

// GET: /api/admin/chat-reports
router.get('/', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        if (!user?.isAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await logAdminAction({
            adminId: user.userId,
            adminUsername: user.username,
            actionType: 'CHAT_REPORTS_ACCESSED',
            details: {
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 50,
                filterReporter: req.query.reporter as string
            }
        });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;
        const filterReporter = req.query.reporter as string;

        let totalQuery = mainDb.selectFrom('chat_report');
        if (filterReporter) {
            totalQuery = totalQuery.where('reporter_user_id', '=', filterReporter);
        }
        const total = await totalQuery.select(({ fn }) => fn.count('id').as('count')).executeTakeFirst();

        let query = mainDb.selectFrom('chat_report').selectAll().orderBy('timestamp', 'desc');
        if (filterReporter) {
            query = query.where('reporter_user_id', '=', filterReporter);
        }
        const reports = await query.limit(limit).offset(offset).execute();

        res.json({
            reports,
            pagination: {
                page,
                limit,
                total: Number(total?.count || 0),
                pages: Math.ceil(Number(total?.count || 0) / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching chat reports:', error);
        res.status(500).json({ error: 'Failed to fetch chat reports' });
    }
});

// PATCH: /api/admin/chat-reports/:id
router.patch('/:id', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        if (!user?.isAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { status } = req.body;
        if (!['pending', 'resolved'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const report = await mainDb
            .selectFrom('chat_report')
            .select(['reported_user_id'])
            .where('id', '=', parseInt(req.params.id))
            .executeTakeFirst();

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        await mainDb
            .updateTable('chat_report')
            .set({ status })
            .where('id', '=', parseInt(req.params.id))
            .execute();

        await logAdminAction({
            adminId: user.userId,
            adminUsername: user.username,
            actionType: 'CHAT_REPORT_STATUS_UPDATED',
            targetUserId: report.reported_user_id,
            details: { reportId: req.params.id, status }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({ error: 'Failed to update report' });
    }
});

// DELETE: /api/admin/chat-reports/:id
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        if (!user?.isAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const report = await mainDb
            .selectFrom('chat_report')
            .select(['reported_user_id'])
            .where('id', '=', parseInt(req.params.id))
            .executeTakeFirst();

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        await mainDb
            .deleteFrom('chat_report')
            .where('id', '=', parseInt(req.params.id))
            .execute();

        await logAdminAction({
            adminId: user.userId,
            adminUsername: user.username,
            actionType: 'CHAT_REPORT_DELETED',
            targetUserId: report.reported_user_id,
            details: { reportId: req.params.id }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

export default router;