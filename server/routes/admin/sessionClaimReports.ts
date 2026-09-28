import express from 'express';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { logAdminAction } from '../../db/audit.js';
import { getClientIp } from '../../utils/getIpAddress.js';
import {
  CLAIM_REPORT_STATUSES,
  countOpenSessionClaimReports,
  listSessionClaimReports,
  updateSessionClaimReportStatus,
  type ClaimReportStatus,
} from '../../db/sessionClaimReports.js';

const router = express.Router();

router.use(requirePermission('admin'));

function isStatus(v: unknown): v is ClaimReportStatus {
  return (
    typeof v === 'string' &&
    (CLAIM_REPORT_STATUSES as readonly string[]).includes(v)
  );
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(
      1,
      Math.min(100, parseInt(req.query.limit as string, 10) || 25)
    );
    const status = isStatus(req.query.status)
      ? req.query.status
      : req.query.status === 'all'
        ? 'all'
        : 'open';
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const [data, openCount] = await Promise.all([
      listSessionClaimReports({ status, page, limit, search }),
      countOpenSessionClaimReports(),
    ]);
    res.json({ ...data, openCount });
  } catch (error) {
    console.error('Error listing session claim reports:', error);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { status, note } = req.body ?? {};
    if (!isStatus(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (note != null && (typeof note !== 'string' || note.length > 1000)) {
      return res.status(400).json({ error: 'Invalid note' });
    }
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const row = await updateSessionClaimReportStatus({
      id: req.params.id,
      status,
      note: typeof note === 'string' && note.trim() ? note.trim() : null,
      reviewedBy: req.user?.userId ?? 'unknown',
    });
    if (!row) return res.status(404).json({ error: 'Report not found' });

    if (req.user?.userId) {
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'SESSION_CLAIM_REPORT_UPDATED',
        targetUserId: row.developer_user_id,
        ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
        userAgent: req.get('User-Agent'),
        details: {
          reportId: row.id,
          status,
          keyId: row.key_id,
          requesterName: row.requester_name,
        },
      });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating session claim report:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

export default router;
