import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getFlightById, validateAcarsAccess } from '../db/flights.js';
import { getSessionById } from '../db/sessions.js';
import {
  defaultAcarsUrl,
  nativeFallbackUrl,
  readExternalAcarsAccess,
} from '../utils/externalAcarsAccess.js';
import {
  fetchExternalAcarsPanelAccess,
  providerForExternalAcarsSession,
  resolveExternalAcarsRedirectUrl,
} from '../utils/externalAcarsPanel.js';

const UPSTREAM_TIMEOUT_MS = 10_000;

const ALLOWED_METHODS: Record<string, readonly string[]> = {
  '/': ['GET'],
  '/acars/': ['POST'],
  '/acars/logon/': ['POST'],
  '/acars/logoff/': ['POST'],
  '/acars/request-pdc/': ['POST'],
  '/acars/respond/': ['POST'],
  '/transponder/': ['POST'],
  '/route/': ['GET', 'POST'],
};

const router = express.Router();

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

router.use(
  rateLimit({
    windowMs: 60_000,
    limit: 180,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

router.post('/resolve/:sessionId/:flightId', async (req, res) => {
  const { sessionId, flightId } = req.params;
  const acarsToken =
    typeof req.body?.acarsToken === 'string' ? req.body.acarsToken : '';

  if (
    !acarsToken ||
    !(await validateAcarsAccess(sessionId, flightId, acarsToken)).valid
  ) {
    return res.status(403).json({ error: 'Invalid ACARS token' });
  }

  const [session, flight] = await Promise.all([
    getSessionById(sessionId),
    getFlightById(sessionId, flightId),
  ]);
  if (!session || !flight) {
    return res.status(404).json({ error: 'Flight not found' });
  }
  const provider = await providerForExternalAcarsSession(session).catch(
    (err) => {
      console.error('[external-acars] provider lookup failed:', err);
      return null;
    }
  );
  if (!provider) return res.json({ mode: 'default' });

  const redirectUrl = await resolveExternalAcarsRedirectUrl(session, {
    ...flight,
    acars_token: acarsToken,
  });
  if (!redirectUrl) return res.json({ mode: 'default' });
  return res.json({ mode: 'external', redirectUrl });
});

function normalizeSuffix(raw: string | string[] | undefined): string {
  if (!raw) return '/';
  const path = (Array.isArray(raw) ? raw.join('/') : raw).replace(/\/+$/, '');
  return `/${path}/`.replace(/^\/\/$/, '/');
}

function claimUrl(sessionId: string, flightId: string, acarsToken: string) {
  const query = new URLSearchParams({
    claimSessionId: sessionId,
    claimFlightId: flightId,
    claimToken: acarsToken,
  });
  return `/my-flights?${query}`;
}

async function proxyExternalAcars(req: Request, res: Response) {
  const { providerId } = req.params;
  const callsign = String(req.params.callsign).toUpperCase();
  const suffix = normalizeSuffix(
    (req.params as { suffix?: string | string[] }).suffix
  );

  const allowed = ALLOWED_METHODS[suffix];
  if (!allowed) return res.status(404).json({ error: 'Not found' });
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const access = readExternalAcarsAccess(req.get('X-External-ACARS-Token'));
  if (
    !access ||
    access.providerId !== providerId ||
    access.callsign !== callsign
  ) {
    return res.status(401).json({
      code: 'access_expired',
      error: 'ACARS access expired. Reopen ACARS from your submitted flight.',
    });
  }

  const [session, validation] = await Promise.all([
    getSessionById(access.sessionId),
    validateAcarsAccess(access.sessionId, access.flightId, access.acarsToken),
  ]);
  if (!session || !validation.valid) {
    return res.status(403).json({
      code: 'flight_unavailable',
      error: 'This flight is no longer available.',
    });
  }

  const provider = await providerForExternalAcarsSession(session);
  if (!provider || provider.id !== access.providerId) {
    return res.status(409).json({
      code: 'acars_mode_changed',
      redirectUrl: defaultAcarsUrl(
        access.sessionId,
        access.flightId,
        access.acarsToken
      ),
    });
  }

  const fallbackUrl =
    req.method === 'GET' && suffix === '/'
      ? nativeFallbackUrl(access.sessionId, access.flightId, access.acarsToken)
      : undefined;
  const failed = (status: number, body: Record<string, unknown>) =>
    res.status(status).json(fallbackUrl ? { ...body, fallbackUrl } : body);

  const hasBody = req.method !== 'GET';
  const call = async (providerToken: string) => {
    const upstream = await fetch(
      `${provider.apiBaseUrl}/api/v1/pilot/flights/${encodeURIComponent(callsign)}${suffix}`,
      {
        method: req.method,
        headers: {
          [provider.tokenHeader]: providerToken,
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        },
        body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }
    );
    const text = await upstream.text();
    let data: Record<string, unknown> | null = {};
    if (text) {
      try {
        const parsed: unknown = JSON.parse(text);
        data =
          parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
      } catch {
        data = null;
      }
    }
    return { upstream, data };
  };

  try {
    let { upstream, data } = await call(access.providerToken);
    const tokenRejected = () =>
      upstream.status === 403 && data?.type === 'NOT_AUTHENTICATED';

    if (tokenRejected()) {
      const renewed = await fetchExternalAcarsPanelAccess(
        callsign,
        access.acarsToken,
        provider
      );
      if (renewed) ({ upstream, data } = await call(renewed.token));
      if (!renewed || tokenRejected()) {
        return failed(401, {
          code: 'access_expired',
          error:
            'ACARS access expired. Reopen ACARS from your submitted flight.',
        });
      }
    }

    if (!data) {
      return failed(502, {
        code: 'provider_invalid_response',
        error: 'The ACARS provider returned an unreadable response.',
      });
    }

    if (!upstream.ok) {
      const requestId = upstream.headers.get('X-Request-ID');
      const code = typeof data.type === 'string' ? data.type : data.code;
      return failed(upstream.status, {
        ...data,
        code,
        ...(requestId ? { requestId } : {}),
      });
    }
    if (suffix === '/') {
      return res.json({
        ...data,
        pfcontrol: {
          claimUrl: claimUrl(
            access.sessionId,
            access.flightId,
            access.acarsToken
          ),
        },
      });
    }
    return res.json(data);
  } catch {
    return failed(502, {
      code: 'provider_unreachable',
      error:
        'The ACARS provider could not be reached. Your command is not confirmed.',
    });
  }
}

router.all('/:providerId/flights/:callsign', proxyExternalAcars);
router.all('/:providerId/flights/:callsign/*suffix', proxyExternalAcars);

export default router;
