import express from 'express';
import type { Request, Response } from 'express';
import {
  createSession,
  getSessionById,
  getPublicNetworkSessionForDeveloperApi,
  listDeveloperSessionSummariesForUser,
  listPublicNetworkSessionsForDeveloperApi,
  type DeveloperPublicNetworkKind,
  type PublicNetworkSessionDeveloperRow,
} from '../../db/sessions.js';
import {
  addFlight,
  getFlightById,
  getFlightsBySessionForDeveloperApi,
  sanitizeFlightForClient,
  updateFlight,
} from '../../db/flights.js';
import { addSessionToUser } from '../../db/users.js';
import { generateSessionId, generateAccessId } from '../../utils/ids.js';
import { recordNewFlight, recordNewSession } from '../../db/statistics.js';
import { getSessionsByUser } from '../../db/sessions.js';
import {
  sessionCreationLimiter,
  flightCreationLimiter,
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

const router = express.Router();

/** Express 5 types dynamic segments as `string | string[]`. */
function routeParamString(
  v: string | string[] | undefined
): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function extCtx(req: Request) {
  const ext = req.developerExt;
  if (!ext) throw new Error('developerExt missing');
  return ext;
}

function publicNetworkSessionJson(
  row: PublicNetworkSessionDeveloperRow,
  kind: DeveloperPublicNetworkKind
) {
  return {
    sessionId: row.session_id,
    airportIcao: row.airport_icao,
    activeRunway: row.active_runway,
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
    res.status(500).json({ error: 'Failed to list PFATC sessions' });
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
    res.status(500).json({ error: 'Failed to load session' });
  }
});

router.get('/network/aatc', async (req: Request, res: Response) => {
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

router.get('/network/aatc/:sessionId', async (req: Request, res: Response) => {
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

// 404 for missing or sessions the key owner did not create (no enumeration).
async function loadOwnedSessionOr404(
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
    res.status(500).json({ error: 'Failed to list sessions' });
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
      } = req.body ?? {};
      if (!airportIcao || typeof airportIcao !== 'string') {
        return res.status(400).json({ error: 'Airport ICAO is required' });
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
        airportIcao,
        createdBy: ext.userId,
        isPFATC: pfatc,
        isAdvancedATC: advancedAtc,
        developerApiKeyId: ext.keyId,
      });
      await addSessionToUser(ext.userId, sessionId);
      await recordNewSession();

      const created = await getSessionById(sessionId);
      if (!created) {
        return res
          .status(500)
          .json({ error: 'Failed to load created session' });
      }

      res.status(201).json(sessionToDeveloperJson(created, ext.keyId));
    } catch (error) {
      if (error instanceof ExclusiveSessionNetworkFlagsError) {
        return res.status(400).json({
          error: 'Invalid session type',
          message:
            'Choose either PFATC Network or Advanced ATC Session, not both.',
        });
      }
      console.error('[ext/sessions] create:', error);
      res.status(500).json({ error: 'Failed to create session' });
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
    res.status(500).json({ error: 'Failed to load session' });
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
    res.status(500).json({ error: 'Failed to list flights' });
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
      res.status(500).json({ error: 'Failed to load flight' });
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

      const flightData = {
        ...req.body,
        user_id: ext.userId,
        ip_address: null,
      };

      const ownerView = await addFlight(loaded.session.session_id, flightData);
      await recordNewFlight();

      const inserted = ownerView.id
        ? await getFlightById(loaded.session.session_id, ownerView.id)
        : null;
      const payload = inserted ? sanitizeFlightForClient(inserted) : {};
      broadcastFlightEvent(loaded.session.session_id, 'flightAdded', payload);

      res.status(201).json(payload);
    } catch (e) {
      console.error('[ext/sessions] add flight:', e);
      res.status(500).json({ error: 'Failed to add flight' });
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

      const flight = await updateFlight(
        session.session_id,
        fid,
        req.body ?? {}
      );
      broadcastFlightEvent(session.session_id, 'flightUpdated', flight);
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
      res.status(500).json({ error: 'Failed to update flight' });
    }
  }
);

export default router;
