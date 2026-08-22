import express from 'express';
import { mainDb } from '../db/connection.js';
import { getSitemapProfileUsernames } from '../db/sitemapProfiles.js';
import { getSitemapFeaturedFlightIds } from '../db/sitemapFlights.js';

const router = express.Router();

// Hardcoded rather than derived from the request host so canary never emits
// its own domain into a sitemap — every environment always points crawlers
// at the same canonical production URLs, matching astro.config.mjs's SITE
// constant and robots.txt.
const SITE = 'https://pfcontrol.com';

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildUrlset(urls: string[]): string {
  const body = urls.map((u) => `<url><loc>${xmlEscape(u)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

router.get('/sitemap-users.xml', async (_req, res) => {
  try {
    const adminIds = (process.env.ADMIN_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const usernames = await getSitemapProfileUsernames(mainDb, adminIds);
    const urls = usernames.map((u) => `${SITE}/user/${encodeURIComponent(u)}`);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(buildUrlset(urls));
  } catch (err) {
    console.error('[sitemap] users:', err);
    res.status(500).type('text/plain').send('Failed to generate sitemap');
  }
});

router.get('/sitemap-flights.xml', async (_req, res) => {
  try {
    const ids = await getSitemapFeaturedFlightIds(mainDb);
    const urls = ids.map((id) => `${SITE}/flight/${encodeURIComponent(id)}`);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(buildUrlset(urls));
  } catch (err) {
    console.error('[sitemap] flights:', err);
    res.status(500).type('text/plain').send('Failed to generate sitemap');
  }
});

export default router;
