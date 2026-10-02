import express from 'express';

import {
  CHART_CACHE_SEC,
  getCelesbitCharts,
  getCelesbitPlate,
} from '../utils/celesbitCharts.js';
import { chartSubjectFor } from '../utils/chartSubject.js';
import { applyPublicCache } from '../utils/httpCache.js';

const router = express.Router();

/**
 * A plate is marked with the person it was fetched for, so it is not a shared asset.
 *
 * Cached publicly, one user's marked chart would be served to everyone behind the edge -- and a
 * trace of a leak would then name whoever happened to warm the cache rather than whoever leaked.
 * The browser that asked may keep its own copy; nothing in between may.
 */
function applyPerUserCache(res: express.Response, maxAge: number): void {
  res.setHeader('Cache-Control', `private, max-age=${maxAge}`);
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
}

// GET: /api/charts - Celesbit chart index
router.get('/', async (req, res) => {
  const charts = await getCelesbitCharts(chartSubjectFor(req, res));
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

  // Which airports exist is the same for everyone, so the browser may still hold it -- but it is
  // fetched per user and may carry a Set-Cookie, so the edge must not.
  applyPublicCache(res, {
    browserMaxAge: 60 * 60,
    edgeMaxAge: 0,
    vary: 'Cookie',
  });
  res.json({ airports });
});

// GET: /api/charts/plate/:icao/:file - chart image
router.get('/plate/:icao/:file', async (req, res) => {
  const image = await getCelesbitPlate(
    chartSubjectFor(req, res),
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
