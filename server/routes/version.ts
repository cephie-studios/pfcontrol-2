import express from 'express';
import { getAppVersion } from '../db/version.js';
import { redisConnection } from '../db/connection.js';
import { applyPublicCache } from '../utils/httpCache.js';
import {
  APP_VERSION_BROWSER_SEC,
  APP_VERSION_EDGE_SEC,
  APP_VERSION_REDIS_SEC,
  prefixKey,
} from '../utils/cacheTtl.js';

const router = express.Router();

// GET: /api/version - Get app version (cached)
router.get('/', async (req, res) => {
  const cacheKey = prefixKey('app:version');

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      applyPublicCache(res, {
        browserMaxAge: APP_VERSION_BROWSER_SEC,
        edgeMaxAge: APP_VERSION_EDGE_SEC,
      });
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
        APP_VERSION_REDIS_SEC
      );
    } catch (error) {
      if (error instanceof Error) {
        console.warn(
          '[Redis] Failed to set cache for app version:',
          error.message
        );
      }
    }

    applyPublicCache(res, {
      browserMaxAge: APP_VERSION_BROWSER_SEC,
      edgeMaxAge: APP_VERSION_EDGE_SEC,
    });
    res.json(versionData);
  } catch (error) {
    console.error('Error fetching app version:', error);
    res.status(500).json({ error: 'Failed to fetch app version' });
  }
});

export default router;
