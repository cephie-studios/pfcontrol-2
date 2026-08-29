import express from 'express';

import requireAuth from '../middleware/auth.js';
import { turnCredentialLimiter } from '../middleware/rateLimiting.js';
import {
  getTurnIceServers,
  isTurnConfigured,
  pruneTurnCredentialCache,
} from '../utils/cloudflareTurn.js';

const router = express.Router();

// GET: /api/turn/credentials - short-lived ICE servers for the voice chat client
router.get(
  '/credentials',
  turnCredentialLimiter,
  requireAuth,
  async (req, res) => {
    if (!isTurnConfigured()) {
      // Not an error: voice chat still works over STUN for most peers.
      return res.json({ iceServers: [], turnAvailable: false });
    }

    pruneTurnCredentialCache();

    const iceServers = await getTurnIceServers(req.user!.userId);

    if (!iceServers) {
      return res.json({ iceServers: [], turnAvailable: false });
    }

    // Credentials are short-lived but still user-scoped secrets.
    res.set('Cache-Control', 'no-store');
    res.json({ iceServers, turnAvailable: true });
  }
);

export default router;
