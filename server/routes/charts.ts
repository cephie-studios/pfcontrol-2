import express, { type Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

import {
  CHART_CACHE_SEC,
  getCelesbitCharts,
  getCelesbitPlate,
} from '../utils/celesbitCharts.js';
import requireAuth from '../middleware/auth.js';
import { chartSubjectFor } from '../utils/chartSubject.js';
import {
  ChartfoxAuthError,
  chartfoxAuthorizeUrl,
  getChartfoxAirportCharts,
  getChartfoxChart,
  getChartfoxFile,
  getChartfoxStatus,
  isChartfoxConfigured,
  linkChartfoxAccount,
  unlinkChartfoxAccount,
} from '../utils/chartfox.js';
import { applyPublicCache } from '../utils/httpCache.js';
import requireAuth from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';

const router = express.Router();

// Each plate is marked for one user, so only the browser that asked may cache it.
function applyPerUserCache(res: express.Response, maxAge: number): void {
  res.setHeader('Cache-Control', `private, max-age=${maxAge}`);
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
const JWT_SECRET = process.env.JWT_SECRET ?? '';
const FRONTEND_URL = process.env.FRONTEND_URL ?? '';
const ICAO_PATTERN = /^[A-Z0-9]{2,7}$/;
const CHART_ID_PATTERN = /^[0-9a-f-]{36}$/i;

const chartfoxLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many chart requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

type LinkMode = 'popup' | 'redirect';

interface LinkState {
  userId: string;
  mode: LinkMode;
}

function linkResultUrl(mode: LinkMode, ok: boolean) {
  if (mode === 'popup') {
    return `${FRONTEND_URL}/charts/chartfox/linked?status=${ok ? 'linked' : 'error'}`;
  }
  return ok
    ? `${FRONTEND_URL}/settings?chartfox_linked=true`
    : `${FRONTEND_URL}/settings?error=chartfox_auth_failed`;
}

function keepOpener(res: Response) {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
}

function sendChartfoxError(res: Response, error: unknown) {
  if (error instanceof ChartfoxAuthError) {
    return res.status(401).json({ error: 'chartfox_not_linked' });
  }
  console.error('[ChartFox] Request failed:', error);
  return res.status(502).json({ error: 'ChartFox is unavailable' });
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

// GET: /api/charts/chartfox/status - ChartFox link status for the current user
router.get('/chartfox/status', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(await getChartfoxStatus(req.user.userId));
});

// GET: /api/charts/chartfox/connect - redirect to ChartFox for account linking
router.get('/chartfox/connect', requireAuth, (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isChartfoxConfigured()) {
    return res.status(503).json({ error: 'ChartFox is not configured' });
  }
  const mode: LinkMode = req.query.mode === 'popup' ? 'popup' : 'redirect';
  const state = jwt.sign(
    { userId: req.user.userId, mode } satisfies LinkState,
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  keepOpener(res);
  res.redirect(chartfoxAuthorizeUrl(state));
});

// GET: /api/charts/chartfox/callback - ChartFox OAuth callback
router.get('/chartfox/callback', authLimiter, async (req, res) => {
  keepOpener(res);
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const rawState = typeof req.query.state === 'string' ? req.query.state : '';

  let state: LinkState;
  try {
    state = jwt.verify(rawState, JWT_SECRET) as LinkState;
  } catch {
    return res.redirect(linkResultUrl('redirect', false));
  }
  if (!code || !state.userId) {
    return res.redirect(linkResultUrl(state.mode, false));
  }

  try {
    const ok = await linkChartfoxAccount(state.userId, code);
    res.redirect(linkResultUrl(state.mode, ok));
  } catch (error) {
    console.error('[ChartFox] Link failed:', error);
    res.redirect(linkResultUrl(state.mode, false));
  }
});

// DELETE: /api/charts/chartfox - unlink ChartFox
router.delete('/chartfox', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  await unlinkChartfoxAccount(req.user.userId);
  res.json({ success: true });
});

// GET: /api/charts/chartfox/airports/:icao - ChartFox charts for an airport
router.get(
  '/chartfox/airports/:icao',
  requireAuth,
  chartfoxLimiter,
  async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const icao = req.params.icao.toUpperCase();
    if (!ICAO_PATTERN.test(icao)) {
      return res.status(400).json({ error: 'Invalid airport' });
    }
    try {
      const charts = await getChartfoxAirportCharts(req.user.userId, icao);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.json({ charts });
    } catch (error) {
      sendChartfoxError(res, error);
    }
  }
);

// GET: /api/charts/chartfox/charts/:id - ChartFox chart details
router.get(
  '/chartfox/charts/:id',
  requireAuth,
  chartfoxLimiter,
  async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!CHART_ID_PATTERN.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid chart' });
    }
    try {
      const chart = await getChartfoxChart(req.user.userId, req.params.id);
      if (!chart) return res.status(404).json({ error: 'Chart not found' });
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.json({ chart });
    } catch (error) {
      sendChartfoxError(res, error);
    }
  }
);

// GET: /api/charts/chartfox/charts/:id/file - ChartFox chart file (PDF or image)
router.get(
  '/chartfox/charts/:id/file',
  requireAuth,
  chartfoxLimiter,
  async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!CHART_ID_PATTERN.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid chart' });
    }
    try {
      const file = await getChartfoxFile(req.user.userId, req.params.id);
      if (!file)
        return res.status(404).json({ error: 'Chart file unavailable' });
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('Content-Disposition', 'inline');
      res.type(file.contentType).send(file.body);
    } catch (error) {
      sendChartfoxError(res, error);
    }
  }
);

export default router;
