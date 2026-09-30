import express from 'express';

import {
  CHART_CACHE_SEC,
  getCelesbitCharts,
  getCelesbitPlate,
} from '../utils/celesbitCharts.js';
import { applyPublicCache } from '../utils/httpCache.js';

const router = express.Router();

// GET: /api/charts - Celesbit chart index
router.get('/', async (_req, res) => {
  const charts = await getCelesbitCharts();
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

  applyPublicCache(res, { browserMaxAge: 60 * 60 });
  res.json({ airports });
});

// GET: /api/charts/plate/:icao/:file - chart image
router.get('/plate/:icao/:file', async (req, res) => {
  const image = await getCelesbitPlate(
    req.params.icao.toUpperCase(),
    req.params.file
  );
  if (!image) {
    return res.status(404).json({ error: 'Chart not found' });
  }

  applyPublicCache(res, {
    browserMaxAge: 60 * 60,
    edgeMaxAge: CHART_CACHE_SEC,
  });
  res.type(image.contentType).send(image.body);
});

export default router;
