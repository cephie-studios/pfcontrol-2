import express from 'express';
import { requirePermission } from '../../middleware/rolePermissions.js';
import {
  getControllerRatingStats,
  getControllerRatingsDailyStats,
  getAllControllerRatingsAdmin,
} from '../../db/admin.js';
import { deleteControllerRating } from '../../db/ratings.js';
import { logAdminAction } from '../../db/audit.js';
import { getClientIp } from '../../utils/getIpAddress.js';

const router = express.Router();

// GET: /api/admin/ratings - List individual controller ratings (moderation)
router.get('/', requirePermission('admin'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? '25'), 10) || 25)
    );
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const ratingParam = req.query.rating;
    const rating =
      typeof ratingParam === 'string' && ratingParam !== ''
        ? parseInt(ratingParam, 10)
        : undefined;

    const result = await getAllControllerRatingsAdmin(
      page,
      limit,
      search,
      rating
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching controller ratings list:', error);
    res.status(500).json({ error: 'Failed to fetch controller ratings' });
  }
});

// DELETE: /api/admin/ratings/:id - Delete a controller rating
router.delete('/:id', requirePermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);

    const rating = await deleteControllerRating(numericId);

    if (req.user?.userId) {
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'CONTROLLER_RATING_DELETED',
        ipAddress: getClientIp(req),
        details: { message: `Deleted controller rating with ID: ${numericId}` },
      });
    }

    res.json(rating);
  } catch (error) {
    console.error('Error deleting controller rating:', error);
    res.status(500).json({ error: 'Failed to delete controller rating' });
  }
});

// GET: /api/admin/ratings/stats - Get controller rating statistics
router.get('/stats', requirePermission('admin'), async (req, res) => {
  try {
    const stats = await getControllerRatingStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching controller rating stats:', error);
    res.status(500).json({ error: 'Failed to fetch rating statistics' });
  }
});

// GET: /api/admin/ratings/daily - Get daily controller rating statistics
router.get('/daily', requirePermission('admin'), async (req, res) => {
  try {
    const daysParam = req.query.days;
    const days =
      typeof daysParam === 'string'
        ? parseInt(daysParam)
        : Array.isArray(daysParam) && typeof daysParam[0] === 'string'
          ? parseInt(daysParam[0])
          : 30;

    const dailyStats = await getControllerRatingsDailyStats(days);
    res.json(dailyStats);
  } catch (error) {
    console.error('Error fetching daily controller rating stats:', error);
    res.status(500).json({ error: 'Failed to fetch daily rating statistics' });
  }
});

export default router;
