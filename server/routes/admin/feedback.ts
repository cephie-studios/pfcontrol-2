import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { logAdminAction } from '../../db/audit.js';
import {
  getAllFeedback,
  deleteFeedback,
  getFeedbackStats,
} from '../../db/feedback.js';
import { getClientIp } from '../../utils/getIpAddress.js';

const router = express.Router();

// GET: /api/admin/feedback - Get all feedback
router.get(
  '/',
  createAuditLogger('ADMIN_FEEDBACK_ACCESSED'),
  async (req, res) => {
    try {
      const feedback = await getAllFeedback();
      res.json(feedback);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  }
);

// GET: /api/admin/feedback/stats - Get feedback statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await getFeedbackStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({ error: 'Failed to fetch feedback stats' });
  }
});

// DELETE: /api/admin/feedback/:id - Delete feedback
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);

    const feedback = await deleteFeedback(numericId);

    if (req.user?.userId) {
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'FEEDBACK_DELETED',
        ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
        details: { message: `Deleted feedback with ID: ${numericId}` },
      });
    }

    res.json(feedback);
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

export default router;
