import express from 'express';
import type { Request, Response } from 'express';
import {
  createSession,
  getSessionById,
  updateSession,
  getPublicNetworkSessionForDeveloperApi,
  listDeveloperSessionSummariesForUser,
  listPublicNetworkSessionsForDeveloperApi,
  type DeveloperPublicNetworkKind,
  type PublicNetworkSessionDeveloperRow,
} from '../../db/sessions.js';
import { encrypt } from '../../utils/encryption.js';
import { parsePublicSessionAtis } from '../../utils/publicSessionAtis.js';
import { sanitizeAlphanumeric } from '../../utils/sanitization.js';
import {
  addFlight,
  getFlightById,
  getFlightsBySessionForDeveloperApi,
  sanitizeFlightForClient,
  updateFlight,
} from '../../db/flights.js';
import { addSessionToUser, getUserById } from '../../db/users.js';
import { logFlightAction } from '../../db/flightLogs.js';
import { generateSessionId, generateAccessId } from '../../utils/ids.js';
import { recordNewFlight, recordNewSession } from '../../db/statistics.js';
import { getSessionsByUser } from '../../db/sessions.js';
import {
  sessionCreationLimiter,
  flightCreationLimiter,
  networkFlightBatchLimiter,
} from '../../middleware/rateLimiting.js';
import { getUserRoles } from '../../db/roles.js';
import { isAdmin } from '../../middleware/admin.js';
import { ExclusiveSessionNetworkFlagsError } from '../../utils/sessionNetworkFlags.js';
import {
  validateSessionId,
  validateFlightId,
  validateCallsign,
} from '../../utils/validation.js';
import { broadcastFlightEvent } from '../../websockets/flightsWebsocket.js';
import { sendServerError } from '../../utils/apiError.js';
import { fromCamelCaseFlightBody } from '../../utils/caseConversion.js';
import {
  isValidAirportIcao,
  isValidRunwayForAirport,
} from '../../utils/flightUtils.js';
import {
  getDeveloperNetworkSnapshot,
  type OverviewData,
} from '../../realtime/overview.js';

const router = express.Router();

/** Express 5 types dynamic segments as `string | string[]`. */
export function routeParamString(
  v: string | string[] | undefined
): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export async function usernameFor(userId: string): Promise<string> {
  try {
    const user = await getUserById(userId);
    return user?.username || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function extCtx(req: Request) {
  const ext = req.developerExt;
  if (!ext) throw new Error('developerExt missing');
  return ext;
}

function validateFlightAirportFields(
  fields: Record<string, unknown>,
  fallbackDepartureIcao?: string | null
): { error: string } | null {
  const departure =
    typeof fields.departure === 'string' ? fields.departure : undefined;
  const arrival =
    typeof fields.arrival === 'string' ? fields.arrival : undefined;
  const alternate =
    typeof fields.alternate === 'string' ? fields.alternate : undefined;
  const runway =
    typeof fields.runway === 'string' ? fields.runway : undefined;

  if (departure && !isValidAirportIcao(departure)) {
    return {
      error: `Unknown departure airport ICAO: "${departure}". See GET /data/airports for valid codes.`,
    };
  }
  if (arrival && !isValidAirportIcao(arrival)) {
    return {
      error: `Unknown arrival airport ICAO: "${arrival}". See GET /data/airports for valid codes.`,
    };
  }
  if (alternate && !isValidAirportIcao(alternate)) {
    return {
      error: `Unknown alternate airport ICAO: "${alternate}". See GET /data/airports for valid codes.`,
    };
  }
  if (runway) {
    const runwayIcao = departure ?? fallbackDepartureIcao;
    if (runwayIcao && !isValidRunwayForAirport(runwayIcao, runway)) {
      return {
        error: `Invalid runway: "${runway}" is not a runway at ${runwayIcao.toUpperCase()}. See GET /data/airports/${runwayIcao.toUpperCase()}/runways.`,
      };
    }
  }
  return null;
}

function publicNetworkSessionJson(
  row: PublicNetworkSessionDeveloperRow,
  kind: DeveloperPublicNetworkKind
) {
  return {
    sessionId: row.session_id,
    airportIcao: row.airport_icao,
    activeRunway: row.active_runway,
    arrivalRunway: row.arrival_runway,
    customName: row.custom_name,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    refreshedAt: row.refreshed_at
      ? new Date(row.refreshed_at).toISOString()
      : null,
    flightCount: row.flight_count,
    isPFATC: kind === 'pfatc',
    isAdvancedATC: kind === 'aatc',
    controller: {
      id: row.created_by,
      username: row.username,
      avatar: row.avatar,
    },
  };
}

function parsePublicDirectoryPagination(req: Request): {
  page: number;
  limit: number;
  offset: number;
} {
  const pageRaw = Number(req.query.page);
  const limitRaw = Number(req.query.limit);
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  let limit =
    Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.floor(limitRaw) : 50;
  limit = Math.min(100, Math.max(1, limit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function sessionToDeveloperJson(
  row: {
    session_id: string;
    active_runway?: string | null;
    arrival_runway?: string | null;
    airport_icao: string;
    created_at?: Date | null;
    created_by: string;
    is_pfatc?: boolean | null;
    is_advanced_atc?: boolean | null;
    custom_name?: string | null;
    refreshed_at?: Date | null;
    developer_api_key_id?: string | null;
  },
  keyId: string
) {
  return {
    sessionId: row.session_id,
    activeRunway: row.active_runway ?? null,
    arrivalRunway: row.arrival_runway ?? null,
    airportIcao: row.airport_icao,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    createdBy: row.created_by,
    isPFATC: Boolean(row.is_pfatc),
    isAdvancedATC: Boolean(row.is_advanced_atc),
    customName: row.custom_name ?? null,
    refreshedAt: row.refreshed_at
      ? new Date(row.refreshed_at).toISOString()
      : null,
    apiManaged:
      row.developer_api_key_id != null &&
      String(row.developer_api_key_id) === keyId,
  };
}

router.get('/network/pfatc', async (req: Request, res: Response) => {
  try {
    extCtx(req);
    const { limit, offset } = parsePublicDirectoryPagination(req);
    const airport =
      typeof req.query.airport === 'string' && req.query.airport.trim()
        ? req.query.airport.trim()
        : null;
    const rows = await listPublicNetworkSessionsForDeveloperApi({
      kind: 'pfatc',
      airportIcao: airport,
      limit,
      offset,
    });
    res.json(rows.map((r) => publicNetworkSessionJson(r, 'pfatc')));
  } catch (e) {
    console.error('[ext/sessions] network pfatc list:', e);
    sendServerError(res, 'Failed to list PFATC sessions', e);
  }
});

router.get('/network/pfatc/:sessionId', async (req: Request, res: Response) => {
  try {
    extCtx(req);
    let sid: string;
    try {
      sid = validateSessionId(routeParamString(req.params.sessionId));
    } catch {
      return res.status(404).json({ error: 'Not found' });
    }
    const row = await getPublicNetworkSessionForDeveloperApi(sid, 'pfatc');
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(publicNetworkSessionJson(row, 'pfatc'));
  } catch (e) {
    console.error('[ext/sessions] network pfatc get:', e);
    sendServerError(res, 'Failed to load session', e);
  }
});

export function activeDeveloperNetworkSessions(data: OverviewData) {
  return data.activeSessions
    .filter((s) => s.isPFATC && !s.sessionId.startsWith('sector-'))
    .map((s) => ({
      sessionId: s.sessionId,
      airportIcao: s.airportIcao,
      activeRunway: s.activeRunway,
      createdAt: s.createdAt,
      createdBy: s.createdBy,
      isPFATC: s.isPFATC,
      activeUsers: s.activeUsers,
      controllers: s.controllers,
      atis: s.atis,
      flights: s.flights,
      flightCount: s.flightCount,
    }));
}

function developerOverviewJson(data: OverviewData) {
  const activeSessions = activeDeveloperNetworkSessions(data);

  const arrivalsByAirport: Record<
    string,
    (typeof activeSessions)[number]['flights']
  > = {};
  for (const session of activeSessions) {
    for (const flight of session.flights) {
      if (!flight.arrival) continue;
      const arrivalIcao = flight.arrival.toUpperCase();
      if (!arrivalsByAirport[arrivalIcao]) arrivalsByAirport[arrivalIcao] = [];
      arrivalsByAirport[arrivalIcao].push(flight);
    }
  }

  return {
    activeSessions,
    totalActiveSessions: activeSessions.length,
    totalFlights: activeSessions.reduce((sum, s) => sum + s.flightCount, 0),
    arrivalsByAirport,
    lastUpdated: data.lastUpdated,
  };
}

router.get('/network/overview', async (req: Request, res: Response) => {
  try {
    extCtx(req);
    const snapshot = await getDeveloperNetworkSnapshot();
    res.json(developerOverviewJson(snapshot));
  } catch (e) {
    console.error('[ext/sessions] network overview:', e);
    sendServerError(res, 'Failed to load network overview', e);
  }
});

router.get('/network/flights', async (req: Request, res: Response) => {
  try {
    extCtx(req);
    const snapshot = await getDeveloperNetworkSnapshot();
    const flights = activeDeveloperNetworkSessions(snapshot).flatMap(
      (s) => s.flights
    );
    res.json(flights);
  } catch (e) {
    console.error('[ext/sessions] network flights:', e);
    sendServerError(res, 'Failed to list network flights', e);
  }
});

const NETWORK_MANAGE_ALLOWED_FIELDS = [
  'callsign',
  'remark',
  'squawk',
  'clearedfl',
  'cruisingfl',
  'runway',
  'stand',
  'gate',
  'sid',
  'star',
  'req_at',
  'req_phase',
  'clearance',
] as const;

const MAX_NETWORK_BATCH_SIZE = 25;

function pickAllowedNetworkFields(
  fields: Record<string, unknown>
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of NETWORK_MANAGE_ALLOWED_FIELDS) {
    if (key in fields) picked[key] = fields[key];
  }
  return picked;
}

interface NetworkFlightUpdateItem {
  sessionId?: unknown;
  flightId?: unknown;
  fields?: unknown;
}

router.put(
  '/network/flights',
  networkFlightBatchLimiter,
  async (req: Request, res: Response) => {
    try {
      const ext = extCtx(req);
      const body = req.body as { updates?: NetworkFlightUpdateItem[] };
      if (!Array.isArray(body.updates) || body.updates.length === 0) {
        return res
          .status(400)
          .json({ error: 'updates must be a non-empty array' });
      }
      if (body.updates.length > MAX_NETWORK_BATCH_SIZE) {
        return res.status(400).json({
          error: `Too many updates in one batch (max ${MAX_NETWORK_BATCH_SIZE})`,
        });
      }

      const username = await usernameFor(ext.userId);

      const results = await Promise.all(
        body.updates.map(async (item) => {
          const rawSessionId =
            typeof item.sessionId === 'string' ? item.sessionId : '';
          const rawFlightId =
            typeof item.flightId === 'string' ? item.flightId : '';
          try {
            const sessionId = validateSessionId(rawSessionId);
            const flightId = validateFlightId(rawFlightId);

            const session = await getSessionById(sessionId);
            if (!session || !session.is_pfatc) {
              return { sessionId, flightId, ok: false, error: 'Not found' };
            }

            const fields = pickAllowedNetworkFields(
              fromCamelCaseFlightBody(
                item.fields && typeof item.fields === 'object'
                  ? (item.fields as Record<string, unknown>)
                  : {}
              )
            );
            if (Object.keys(fields).length === 0) {
              return {
                sessionId,
                flightId,
                ok: false,
                error: 'No editable fields provided',
              };
            }

            const before = await getFlightById(sessionId, flightId);
            const airportError = validateFlightAirportFields(
              fields,
              before?.departure
            );
            if (airportError) {
              return { sessionId, flightId, ok: false, error: airportError.error };
            }

            const flight = await updateFlight(sessionId, flightId, fields);
            broadcastFlightEvent(sessionId, 'flightUpdated', flight);

            await logFlightAction({
              userId: ext.userId,
              username,
              sessionId,
              action: 'update',
              flightId,
              oldData: before ? sanitizeFlightForClient(before) : null,
              newData: flight,
            });

            return { sessionId, flightId, ok: true, flight };
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Update failed';
            const error =
              msg === 'Flight not found or update failed'
                ? 'Not found'
                : msg;
            return {
              sessionId: rawSessionId,
              flightId: rawFlightId,
              ok: false,
              error,
            };
          }
        })
      );

      res.json({ results });
    } catch (e) {
      console.error('[ext/sessions] network flights batch update:', e);
      sendServerError(res, 'Failed to update network flights', e);
    }
  }
);

// AATC disabled — /network/aatc routes return 404
router.get('/network/aatc', async (_req: Request, res: Response) => {
  res
    .status(404)
    .json({ error: 'The AATC network is not currently available.' });
});

router.get('/network/aatc/:sessionId', async (_req: Request, res: Response) => {
  res
    .status(404)
    .json({ error: 'The AATC network is not currently available.' });
});

/* AATC_ROUTES_START — uncomment to re-enable
router.get('/network/aatc_DISABLED', async (req: Request, res: Response) => {
  try {
    extCtx(req);
    const { limit, offset } = parsePublicDirectoryPagination(req);
    const airport =
      typeof req.query.airport === 'string' && req.query.airport.trim()
        ? req.query.airport.trim()
        : null;
    const rows = await listPublicNetworkSessionsForDeveloperApi({
      kind: 'aatc',
      airportIcao: airport,
      limit,
      offset,
    });
    res.json(rows.map((r) => publicNetworkSessionJson(r, 'aatc')));
  } catch (e) {
    console.error('[ext/sessions] network aatc list:', e);
    res.status(500).json({ error: 'Failed to list AATC sessions' });
  }
});

router.get('/network/aatc_DISABLED/:sessionId', async (req: Request, res: Response) => {
  try {
    extCtx(req);
    let sid: string;
    try {
      sid = validateSessionId(routeParamString(req.params.sessionId));
    } catch {
      return res.status(404).json({ error: 'Not found' });
    }
    const row = await getPublicNetworkSessionForDeveloperApi(sid, 'aatc');
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(publicNetworkSessionJson(row, 'aatc'));
  } catch (e) {
    console.error('[ext/sessions] network aatc get:', e);
    res.status(500).json({ error: 'Failed to load session' });
  }
});
AATC_ROUTES_END */

// 404 for missing or sessions the key owner did not create (no enumeration).
export async function loadOwnedSessionOr404(
  sessionId: string | string[] | undefined,
  userId: string
) {
  let sid: string;
  try {
    sid = validateSessionId(routeParamString(sessionId));
  } catch {
    return {
      ok: false as const,
      status: 404 as const,
      body: { error: 'Not found' },
    };
  }
  const session = await getSessionById(sid);
  if (!session || session.created_by !== userId) {
    return {
      ok: false as const,
      status: 404 as const,
      body: { error: 'Not found' },
    };
  }
  return { ok: true as const, session };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const ext = extCtx(req);
    const rows = await listDeveloperSessionSummariesForUser(ext.userId);
    res.json(rows.map((r) => sessionToDeveloperJson(r, ext.keyId)));
  } catch (e) {
    console.error('[ext/sessions] list:', e);
    sendServerError(res, 'Failed to list sessions', e);
  }
});

router.post(
  '/',
  sessionCreationLimiter,
  async (req: Request, res: Response) => {
    try {
      const ext = extCtx(req);
      const {
        airportIcao,
        isPFATC = false,
        isAdvancedATC = false,
        activeRunway = null,
        arrivalRunway = null,
      } = req.body ?? {};
      if (!airportIcao || typeof airportIcao !== 'string') {
        return res.status(400).json({ error: 'Airport ICAO is required' });
      }
      if (!isValidAirportIcao(airportIcao)) {
        return res.status(400).json({
          error: `Unknown airport ICAO: "${airportIcao}". See GET /data/airports for valid codes.`,
        });
      }
      if (!activeRunway || typeof activeRunway !== 'string') {
        return res.status(400).json({
          error: `Active (departure) runway is required. See GET /data/airports/${String(airportIcao).toUpperCase()}/runways.`,
        });
      }
      if (activeRunway && !isValidRunwayForAirport(airportIcao, activeRunway)) {
        return res.status(400).json({
          error: `Invalid activeRunway: "${activeRunway}" is not a runway at ${String(airportIcao).toUpperCase()}. See GET /data/airports/${String(airportIcao).toUpperCase()}/runways.`,
        });
      }
      if (
        arrivalRunway &&
        !isValidRunwayForAirport(airportIcao, arrivalRunway)
      ) {
        return res.status(400).json({
          error: `Invalid arrivalRunway: "${arrivalRunway}" is not a runway at ${String(airportIcao).toUpperCase()}. See GET /data/airports/${String(airportIcao).toUpperCase()}/runways.`,
        });
      }

      const pfatc = Boolean(isPFATC);
      const advancedAtc = Boolean(isAdvancedATC);
      if (pfatc && advancedAtc) {
        return res.status(400).json({
          error: 'Invalid session type',
          message:
            'Choose either PFATC Network or Advanced ATC Session, not both.',
        });
      }

      const userSessions = await getSessionsByUser(ext.userId);
      const userRoles = await getUserRoles(ext.userId);
      const isTester =
        isAdmin(ext.userId) ||
        userRoles.some(
          (role) => role.name === 'Tester' || role.name === 'Event Controller'
        );
      const maxSessions = isTester ? 100 : 50;
      if (userSessions.length >= maxSessions) {
        return res.status(400).json({
          error: 'Session limit reached',
          message: `You can only have ${maxSessions} active sessions. Please delete an old session first.`,
        });
      }

      let sessionId = generateSessionId();
      const accessId = generateAccessId();
      let existingSession = await getSessionById(sessionId);
      const MAX_TRIES = 3;
      let attempt = 0;
      while (existingSession && attempt < MAX_TRIES - 1) {
        attempt++;
        sessionId = generateSessionId();
        existingSession = await getSessionById(sessionId);
      }
      if (existingSession) {
        return res
          .status(500)
          .json({ error: 'Session ID collision, please try again.' });
      }

      await createSession({
        sessionId,
        accessId,
        activeRunway: activeRunway ?? undefined,
        arrivalRunway: arrivalRunway ?? undefined,
        airportIcao,
        createdBy: ext.userId,
        isPFATC: pfatc,
        isAdvancedATC: advancedAtc,
        developerApiKeyId: ext.keyId,
      });
      // API-created sessions don't count toward the public leaderboard/profile stats.
      await addSessionToUser(ext.userId, sessionId, {
        countTowardStats: false,
      });
      await recordNewSession();

      const created = await getSessionById(sessionId);
      if (!created) {
        return res
          .status(500)
          .json({ error: 'Failed to load created session' });
      }

      res.status(201).json({
        ...sessionToDeveloperJson(created, ext.keyId),
        accessId: created.access_id,
      });
    } catch (error) {
      if (error instanceof ExclusiveSessionNetworkFlagsError) {
        return res.status(400).json({
          error: 'Invalid session type',
          message:
            'Choose either PFATC Network or Advanced ATC Session, not both.',
        });
      }
      console.error('[ext/sessions] create:', error);
      sendServerError(res, 'Failed to create session', error);
    }
  }
);

router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const ext = extCtx(req);
    const loaded = await loadOwnedSessionOr404(
      req.params.sessionId,
      ext.userId
    );
    if (!loaded.ok) return res.status(loaded.status).json(loaded.body);
    res.json(sessionToDeveloperJson(loaded.session, ext.keyId));
  } catch (e) {
    console.error('[ext/sessions] get:', e);
    sendServerError(res, 'Failed to load session', e);
  }
});

router.put('/:sessionId', async (req: Request, res: Response) => {
  try {
    const ext = extCtx(req);
    const loaded = await loadOwnedSessionOr404(
      req.params.sessionId,
      ext.userId
    );
    if (!loaded.ok) return res.status(loaded.status).json(loaded.body);
    const session = loaded.session;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    if (body.customName !== undefined) {
      updates.custom_name = sanitizeAlphanumeric(String(body.customName), 50);
    }

    if (body.activeRunway !== undefined) {
      if (!isValidRunwayForAirport(session.airport_icao, body.activeRunway)) {
        return res.status(400).json({
          error: `Invalid activeRunway: "${body.activeRunway}" is not a runway at ${session.airport_icao}. See GET /data/airports/${session.airport_icao}/runways.`,
        });
      }
      updates.active_runway = String(body.activeRunway).toUpperCase();
    }

    if (body.arrivalRunway !== undefined) {
      if (!isValidRunwayForAirport(session.airport_icao, body.arrivalRunway)) {
        return res.status(400).json({
          error: `Invalid arrivalRunway: "${body.arrivalRunway}" is not a runway at ${session.airport_icao}. See GET /data/airports/${session.airport_icao}/runways.`,
        });
      }
      updates.arrival_runway = String(body.arrivalRunway).toUpperCase();
    }

    const hasAtisLetter = body.atisLetter !== undefined;
    const hasAtisText = body.atisText !== undefined;
    if (hasAtisLetter || hasAtisText) {
      if (!hasAtisLetter || !hasAtisText) {
        return res.status(400).json({
          error: 'atisLetter and atisText must both be provided together.',
        });
      }
      const letter = String(body.atisLetter).trim().slice(0, 1).toUpperCase();
      if (!/^[A-Z]$/.test(letter)) {
        return res
          .status(400)
          .json({ error: 'atisLetter must be a single letter A-Z.' });
      }
      const text = String(body.atisText).trim();
      if (!text) {
        return res.status(400).json({ error: 'atisText cannot be empty.' });
      }
      if (text.length > 2000) {
        return res.status(400).json({
          error: 'atisText is too long (max 2000 characters).',
        });
      }
      updates.atis = JSON.stringify(
        encrypt({ letter, text, timestamp: new Date().toISOString() })
      );
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error:
          'No editable fields provided. Accepted: customName, activeRunway, arrivalRunway, atisLetter+atisText.',
      });
    }

    const updated = await updateSession(session.session_id, updates);
    if (!updated) return res.status(404).json({ error: 'Not found' });

    res.json({
      ...sessionToDeveloperJson(updated, ext.keyId),
      atis: parsePublicSessionAtis(updated.atis),
    });
  } catch (e) {
    console.error('[ext/sessions] update:', e);
    sendServerError(res, 'Failed to update session', e);
  }
});

router.get('/:sessionId/flights', async (req: Request, res: Response) => {
  try {
    const ext = extCtx(req);
    const loaded = await loadOwnedSessionOr404(
      req.params.sessionId,
      ext.userId
    );
    if (!loaded.ok) return res.status(loaded.status).json(loaded.body);
    const flights = await getFlightsBySessionForDeveloperApi(
      loaded.session.session_id
    );
    res.json(flights);
  } catch (e) {
    console.error('[ext/sessions] list flights:', e);
    sendServerError(res, 'Failed to list flights', e);
  }
});

router.get(
  '/:sessionId/flights/:flightId',
  async (req: Request, res: Response) => {
    try {
      const ext = extCtx(req);
      const loaded = await loadOwnedSessionOr404(
        req.params.sessionId,
        ext.userId
      );
      if (!loaded.ok) return res.status(loaded.status).json(loaded.body);
      let fid: string;
      try {
        fid = validateFlightId(routeParamString(req.params.flightId));
      } catch {
        return res.status(404).json({ error: 'Not found' });
      }
      const flight = await getFlightById(loaded.session.session_id, fid);
      if (!flight) return res.status(404).json({ error: 'Not found' });
      res.json(sanitizeFlightForClient(flight));
    } catch (e) {
      console.error('[ext/sessions] get flight:', e);
      sendServerError(res, 'Failed to load flight', e);
    }
  }
);

router.post(
  '/:sessionId/flights',
  flightCreationLimiter,
  async (req: Request, res: Response) => {
    try {
      const ext = extCtx(req);
      const loaded = await loadOwnedSessionOr404(
        req.params.sessionId,
        ext.userId
      );
      if (!loaded.ok) return res.status(loaded.status).json(loaded.body);

      if (req.body?.callsign) {
        try {
          req.body.callsign = validateCallsign(String(req.body.callsign));
        } catch (err) {
          return res.status(400).json({
            error: err instanceof Error ? err.message : 'Invalid callsign',
          });
        }
      }
      if (req.body?.stand && String(req.body.stand).length > 8) {
        return res
          .status(400)
          .json({ error: 'Stand must be 8 characters or less' });
      }
      if (!req.body?.callsign) {
        return res.status(400).json({ error: 'callsign is required' });
      }
      if (!req.body?.aircraft) {
        return res.status(400).json({ error: 'aircraft is required' });
      }
      if (!req.body?.arrival) {
        return res.status(400).json({ error: 'arrival is required' });
      }
      if (!req.body?.cruisingFL) {
        return res.status(400).json({ error: 'cruisingFL is required' });
      }

      const flightData: Record<string, unknown> = {
        ...fromCamelCaseFlightBody(req.body ?? {}),
        user_id: ext.userId,
        ip_address: null,
      };

      flightData.departure = loaded.session.airport_icao;

      const airportError = validateFlightAirportFields(
        flightData,
        loaded.session.airport_icao
      );
      if (airportError) return res.status(400).json(airportError);

      // API-created flights don't count toward the public leaderboard/profile stats.
      const ownerView = await addFlight(
        loaded.session.session_id,
        flightData,
        { countTowardStats: false }
      );
      await recordNewFlight();

      const inserted = ownerView.id
        ? await getFlightById(loaded.session.session_id, ownerView.id)
        : null;
      const payload = inserted ? sanitizeFlightForClient(inserted) : {};
      broadcastFlightEvent(loaded.session.session_id, 'flightAdded', payload);

      if (ownerView.id) {
        // Awaited (not fire-and-forget) so this write survives a server
        // restart landing between the broadcast above and the log getting
        // written.
        await logFlightAction({
          userId: ext.userId,
          username: await usernameFor(ext.userId),
          sessionId: loaded.session.session_id,
          action: 'add',
          flightId: ownerView.id,
          newData: payload,
        });
      }

      res.status(201).json(payload);
    } catch (e) {
      console.error('[ext/sessions] add flight:', e);
      sendServerError(res, 'Failed to add flight', e);
    }
  }
);

router.put(
  '/:sessionId/flights/:flightId',
  async (req: Request, res: Response) => {
    try {
      const ext = extCtx(req);
      const loaded = await loadOwnedSessionOr404(
        req.params.sessionId,
        ext.userId
      );
      if (!loaded.ok) return res.status(loaded.status).json(loaded.body);

      const session = loaded.session;
      if (String(session.developer_api_key_id ?? '') !== ext.keyId) {
        return res.status(403).json({
          error:
            'Flight updates via the developer API are only allowed for sessions created with this API key.',
        });
      }

      let fid: string;
      try {
        fid = validateFlightId(routeParamString(req.params.flightId));
      } catch {
        return res.status(404).json({ error: 'Not found' });
      }

      if (req.body?.callsign) {
        try {
          req.body.callsign = validateCallsign(String(req.body.callsign));
        } catch (err) {
          return res.status(400).json({
            error: err instanceof Error ? err.message : 'Invalid callsign',
          });
        }
      }
      if (req.body?.stand && String(req.body.stand).length > 8) {
        return res.status(400).json({ error: 'Stand too long' });
      }

      const before = await getFlightById(session.session_id, fid);
      if (!before) return res.status(404).json({ error: 'Not found' });

      const updateFields = fromCamelCaseFlightBody(req.body ?? {});
      const airportError = validateFlightAirportFields(
        updateFields,
        before.departure
      );
      if (airportError) return res.status(400).json(airportError);

      const flight = await updateFlight(session.session_id, fid, updateFields);
      broadcastFlightEvent(session.session_id, 'flightUpdated', flight);

      // Awaited (not fire-and-forget) so this write survives a server
      // restart landing between the broadcast above and the log getting
      // written.
      await logFlightAction({
        userId: ext.userId,
        username: await usernameFor(ext.userId),
        sessionId: session.session_id,
        action: 'update',
        flightId: fid,
        oldData: before ? sanitizeFlightForClient(before) : null,
        newData: flight,
      });

      res.json(flight);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (
        msg === 'Flight not found or update failed' ||
        msg === 'Flight not found'
      ) {
        return res.status(404).json({ error: 'Not found' });
      }
      if (msg === 'No valid fields to update') {
        return res.status(400).json({ error: msg });
      }
      console.error('[ext/sessions] update flight:', e);
      sendServerError(res, 'Failed to update flight', e);
    }
  }
);

export default router;
