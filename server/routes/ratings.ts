import express from 'express';
import { addControllerRating } from '../db/ratings.js';
import requireAuth from '../middleware/auth.js';

const router = express.Router();

// POST: /api/ratings - Submit controller rating
router.post('/', requireAuth, async (req, res) => {
  try {
    const { controllerId, rating, flightId } = req.body;

    if (!controllerId) {
      return res.status(400).json({ error: 'Controller ID is required' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const pilotId = req.user!.userId;

    if (pilotId === controllerId) {
        return res.status(400).json({ error: 'You cannot rate yourself' });
    }

    await addControllerRating(controllerId, pilotId, Number(rating), flightId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting controller rating:', error);
    res.status(500).json({ error: 'Failed to submit controller rating' });
  }
});

export default router;
