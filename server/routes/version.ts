import express from 'express';
import { getAppVersion, updateAppVersion } from '../db/version.js';
import { redisConnection } from '../db/connection.js';
import requireAuth from '../middleware/auth.js';

const router = express.Router();

// GET: /api/version - Get app version (cached)
router.get('/', async (req, res) => {
  const cacheKey = 'app:version';

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        '[Redis] Failed to read cache for app version:',
        error.message
      );
    }
  }

  try {
    const versionData = await getAppVersion();

    try {
      await redisConnection.set(
        cacheKey,
        JSON.stringify(versionData),
        'EX',
        86400
      );
    } catch (error) {
      if (error instanceof Error) {
        console.warn(
          '[Redis] Failed to set cache for app version:',
          error.message
        );
      }
    }

    res.json(versionData);
  } catch (error) {
    console.error('Error fetching app version:', error);
    res.status(500).json({ error: 'Failed to fetch app version' });
  }
});

// PUT: /api/version - Update app version (admin only)
router.put('/', requireAuth, async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { version } = req.body;
    if (!version || typeof version !== 'string') {
      return res
        .status(400)
        .json({ error: 'Version is required and must be a string' });
    }

    const updatedVersion = await updateAppVersion(
      version,
      req.user.username || 'Unknown Admin'
    );

    const cacheKey = 'app:version';
    try {
      await redisConnection.del(cacheKey);
      await redisConnection.set(
        cacheKey,
        JSON.stringify(updatedVersion),
        'EX',
        86400
      );
    } catch (error) {
      if (error instanceof Error) {
        console.warn(
          '[Redis] Failed to update cache for app version:',
          error.message
        );
      }
    }

    res.json(updatedVersion);
  } catch (error) {
    console.error('Error updating app version:', error);
    res.status(500).json({ error: 'Failed to update app version' });
  }
});

export default router;
