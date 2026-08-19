import express from 'express';
import { getPublicPilotProfile } from '../services/publicPilotProfile.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// GET: /api/pilot/:username - Get public pilot profile (user info only)
router.get('/:username', optionalAuth, async (req, res) => {
  try {
    const username = req.params.username;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const profile = await getPublicPilotProfile(username, req.user?.userId);

    if (!profile) {
      return res.status(404).json({ error: 'Pilot not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching pilot profile:', error);
    res.status(500).json({ error: 'Failed to fetch pilot profile' });
  }
});

export default router;
