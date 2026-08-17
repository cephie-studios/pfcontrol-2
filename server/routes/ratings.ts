import express from 'express';
import {
  addControllerRating,
  getControllerRatingStats,
  getControllerRatingsForController,
  getControllerRatingsDailyStatsForController,
  getControllerRatingsDistributionForController,
  reportControllerRating,
} from '../db/ratings.js';
import requireAuth from '../middleware/auth.js';
import { capture } from '../utils/posthog.js';
import { generalApiLimiter } from '../middleware/rateLimiting.js';

const router = express.Router();

const MAX_COMMENT_LENGTH = 500;

// POST: /api/ratings - Submit controller rating
router.post('/', requireAuth, generalApiLimiter, async (req, res) => {
  try {
    const { controllerId, rating, flightId, sessionId, comment } = req.body;

    if (!controllerId) {
      return res.status(400).json({ error: 'Controller ID is required' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    if (
      comment !== undefined &&
      comment !== null &&
      String(comment).length > MAX_COMMENT_LENGTH
    ) {
      return res.status(400).json({
        error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`,
      });
    }

    const pilotId = req.user!.userId;

    if (pilotId === controllerId) {
      return res.status(400).json({ error: 'You cannot rate yourself' });
    }

    try {
      await addControllerRating(
        controllerId,
        pilotId,
        Number(rating),
        flightId,
        sessionId,
        comment
      );
    } catch (error) {
      if ((error as { code?: string })?.code === '23503') {
        return res.status(400).json({ error: 'Invalid session' });
      }
      throw error;
    }

    capture(req, {
      distinctId: pilotId,
      event: 'controller_rated',
      properties: {
        controller_id: controllerId,
        rating: Number(rating),
        flight_id: flightId,
        session_id: sessionId,
        has_comment: Boolean(comment && String(comment).trim()),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting controller rating:', error);
    res.status(500).json({ error: 'Failed to submit controller rating' });
  }
});

// GET: /api/ratings/mine - Controller's own anonymized feedback list
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20)
    );

    const result = await getControllerRatingsForController(
      req.user!.userId,
      page,
      limit
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching own controller ratings:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// POST: /api/ratings/:id/report - Controller reports a comment left on their feedback
router.post('/:id/report', requireAuth, generalApiLimiter, async (req, res) => {
  try {
    const ratingId = Number(req.params.id);
    if (Number.isNaN(ratingId)) {
      return res.status(400).json({ error: 'Invalid rating ID' });
    }

    const { reason } = req.body;
    if (typeof reason !== 'string' || reason.length > 500) {
      return res.status(400).json({ error: 'Invalid or too long reason' });
    }

    const result = await reportControllerRating(
      ratingId,
      req.user!.userId,
      reason
    );

    if (!result) {
      return res.status(404).json({
        error: 'Rating not found, not yours, or already reported',
      });
    }

    capture(req, {
      distinctId: req.user!.userId,
      event: 'rating_reported',
      properties: { rating_id: ratingId },
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error reporting controller rating:', error);
    res.status(500).json({ error: 'Failed to report rating' });
  }
});

// GET: /api/ratings/mine/stats - Controller's own rating stats
router.get('/mine/stats', requireAuth, async (req, res) => {
  try {
    const stats = await getControllerRatingStats(req.user!.userId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching own controller rating stats:', error);
    res.status(500).json({ error: 'Failed to fetch rating stats' });
  }
});

// GET: /api/ratings/mine/daily - Controller's own daily rating trend
router.get('/mine/daily', requireAuth, async (req, res) => {
  try {
    const daysParam = req.query.days;
    const days =
      typeof daysParam === 'string'
        ? parseInt(daysParam)
        : Array.isArray(daysParam) && typeof daysParam[0] === 'string'
          ? parseInt(daysParam[0])
          : 30;

    const dailyStats = await getControllerRatingsDailyStatsForController(
      req.user!.userId,
      days
    );
    res.json(dailyStats);
  } catch (error) {
    console.error('Error fetching own daily controller rating stats:', error);
    res.status(500).json({ error: 'Failed to fetch daily rating stats' });
  }
});

// GET: /api/ratings/mine/distribution - Controller's own rating breakdown by star
router.get('/mine/distribution', requireAuth, async (req, res) => {
  try {
    const daysParam = req.query.days;
    const days =
      typeof daysParam === 'string'
        ? parseInt(daysParam)
        : Array.isArray(daysParam) && typeof daysParam[0] === 'string'
          ? parseInt(daysParam[0])
          : 30;

    const distribution = await getControllerRatingsDistributionForController(
      req.user!.userId,
      days
    );
    res.json(distribution);
  } catch (error) {
    console.error('Error fetching own controller rating distribution:', error);
    res.status(500).json({ error: 'Failed to fetch rating distribution' });
  }
});

export default router;
