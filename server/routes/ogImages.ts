import express from 'express';
import { getPublicPilotProfile } from '../services/publicPilotProfile.js';
import {
  fetchAvatarDataUrl,
  renderPublicProfileOgPng,
} from '../og/renderProfileOgPng.js';
import {
  getCachedProfileOgPng,
  profileOgCacheControlHeader,
  profileOgRedisKey,
  setCachedProfileOgPng,
} from '../og/profileOgCache.js';

const router = express.Router();

// GET /api/og/profile/:username — dynamic Open Graph PNG for pilot profiles
router.get('/profile/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const profile = await getPublicPilotProfile(username);
    if (!profile) {
      return res.status(404).end();
    }

    const cacheKey = profileOgRedisKey(profile);
    const cached = await getCachedProfileOgPng(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', profileOgCacheControlHeader());
      res.send(cached);
      return;
    }

    const frontendBase = process.env.FRONTEND_URL || 'https://pfcontrol.com';
    const avatarDataUrl = await fetchAvatarDataUrl(profile, frontendBase);
    const png = await renderPublicProfileOgPng(profile, avatarDataUrl);
    await setCachedProfileOgPng(cacheKey, png);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', profileOgCacheControlHeader());
    res.send(png);
  } catch (error) {
    console.error('[og] profile png:', error);
    res.status(500).end();
  }
});

export default router;