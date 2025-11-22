import express from 'express';
import { addFeedback } from '../db/feedback.js';
import requireAuth from '../middleware/auth.js';

const router = express.Router();

// POST: /api/feedback - Submit feedback
router.post('/', requireAuth, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const feedback = await addFeedback({
      userId: req.user!.userId || '',
      username: req.user!.username || '',
      rating: Number(rating),
      comment: comment?.trim() || undefined,
    });

    res.json(feedback);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

export default router;
