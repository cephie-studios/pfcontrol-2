import express from 'express';

import {
  CHART_CACHE_SEC,
  getCelesbitCharts,
  getCelesbitPlate,
} from '../utils/celesbitCharts.js';
import requireAuth from '../middleware/auth.js';
import { chartSubjectFor } from '../utils/chartSubject.js';
import { applyPublicCache } from '../utils/httpCache.js';

const router = express.Router();

// Each plate is marked for one user, so only the browser that asked may cache it.
function applyPerUserCache(res: express.Response, maxAge: number): void {
  res.setHeader('Cache-Control', `private, max-age=${maxAge}`);
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
}

// GET: /api/charts - Celesbit chart index
router.get('/', requireAuth, async (req, res) => {
  const subject = chartSubjectFor(req);
  if (!subject) {
    return res.status(503).json({ error: 'Charts are unavailable' });
  }

  const charts = await getCelesbitCharts(subject);
  if (!charts) {
    return res.status(503).json({ error: 'Charts are unavailable' });
  }

  const airports = Object.fromEntries(
    Object.entries(charts.airports).map(([icao, plates]) => [
      icao,
      plates.map(({ kind, kindLabel, label, file }) => ({
        kind,
        kindLabel,
        label,
        file,
      })),
    ])
  );

  // Same list for everyone, but fetched per user, so the edge must not hold it.
  applyPublicCache(res, {
    browserMaxAge: 60 * 60,
    edgeMaxAge: 0,
    vary: 'Cookie',
  });
  res.json({ airports });
});

// GET: /api/charts/plate/:icao/:file - chart image
router.get('/plate/:icao/:file', requireAuth, async (req, res) => {
  const subject = chartSubjectFor(req);
  if (!subject) {
    return res.status(503).json({ error: 'Charts are unavailable' });
  }

  const image = await getCelesbitPlate(
    subject,
    req.params.icao.toUpperCase(),
    req.params.file
  );
  if (!image) {
    return res.status(404).json({ error: 'Chart not found' });
  }

  applyPerUserCache(res, CHART_CACHE_SEC);
  res.type(image.contentType).send(image.body);
});

export default router;
