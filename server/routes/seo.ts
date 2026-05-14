import express from 'express';
import { mainDb } from '../db/connection.js';
import { getSitemapProfileUsernames } from '../db/sitemapProfiles.js';

const router = express.Router();

router.get('/sitemap-profiles', async (_req, res) => {
  try {
    const adminIds = (process.env.ADMIN_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const usernames = await getSitemapProfileUsernames(mainDb, adminIds);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ usernames });
  } catch (err) {
    console.error('[seo] sitemap-profiles:', err);
    res.status(500).json({ error: 'Failed to load sitemap profile list' });
  }
});

export default router;