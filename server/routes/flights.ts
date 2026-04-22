import express from 'express';
import requireAuth, { optionalAuth } from '../middleware/auth.js';
import { requireFlightAccess } from '../middleware/flightAccess.js';
import {
  getFlightsBySession,
  getFlightsByUser,
  getFlightByIdForUser,
  getFlightLogsForUser,
  claimFlightForUser,
  getFlightById,
  addFlight,
  updateFlight,
  deleteFlight,
  validateAcarsAccess,
  updateFlightNotes,
} from '../db/flights.js';
import { broadcastFlightEvent } from '../websockets/flightsWebsocket.js';
import { recordNewFlight } from '../db/statistics.js';
import { getClientIp } from '../utils/getIpAddress.js';
import { mainDb } from '../db/connection.js';
import {
  flightCreationLimiter,
  acarsValidationLimiter,
} from '../middleware/rateLimiting.js';
import { validateCallsign } from '../utils/validation.js';

const router = express.Router();

const activeAcarsTerminals = new Map<string, {
  sessionId: string;
  flightId: string;
  connectedAt: string;
  lastSeen: number;
}>();

// Cleanup old ACARS terminals periodically
const cleanupAcarsTerminals = () => {
  const now = Date.now();
  const INACTIVE_THRESHOLD = 10 * 60 * 1000;
  let removedCount = 0;
  
  for (const [key, terminal] of activeAcarsTerminals.entries()) {
    if (now - terminal.lastSeen > INACTIVE_THRESHOLD) {
      activeAcarsTerminals.delete(key);
      removedCount++;
    }
  }
  
  if (removedCount > 0) {
    console.log(`[ACARS] Cleaned up ${removedCount} inactive terminals`);
  }
};

const acarsCleanupInterval = setInterval(cleanupAcarsTerminals, 5 * 60 * 1000);

// Cleanup on shutdown
process.on('SIGTERM', () => {
  console.log('[ACARS] Cleaning up...');
  clearInterval(acarsCleanupInterval);
  activeAcarsTerminals.clear();
});

// GET: /api/flights/me - get flights submitted by current user
router.get('/me/list', requireAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const flights = await getFlightsByUser(req.user.userId);
    res.json(flights);
  } catch {
    res.status(500).json({ error: 'Failed to fetch your flights' });
  }
});

// GET: /api/flights/me/:flightId - get one owned flight
router.get('/me/:flightId', requireAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const flight = await getFlightByIdForUser(req.user.userId, req.params.flightId);
    if (!flight) return res.status(404).json({ error: 'Flight not found' });
    res.json(flight);
  } catch {
    res.status(500).json({ error: 'Failed to fetch flight' });
  }
});

// PATCH: /api/flights/me/:flightId/notes - save personal notes for owned flight
router.patch('/me/:flightId/notes', requireAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { notes } = req.body ?? {};
    if (typeof notes !== 'string' || notes.length > 2000) {
      return res.status(400).json({ error: 'Notes must be a string under 2000 characters' });
    }
    await updateFlightNotes(req.user.userId, req.params.flightId, notes);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

// GET: /api/flights/me/:flightId/logs - get owned flight logs
router.get('/me/:flightId/logs', requireAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const logsData = await getFlightLogsForUser(
      req.user.userId,
      req.params.flightId
    );
    res.json(logsData);
  } catch {
    res.status(500).json({ error: 'Failed to fetch flight logs' });
  }
});

// POST: /api/flights/claim - claim a just-submitted guest flight after login
router.post('/claim', requireAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { sessionId, flightId, acarsToken } = req.body ?? {};
    if (!sessionId || !flightId || !acarsToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await claimFlightForUser(
      String(sessionId),
      String(flightId),
      String(acarsToken),
      req.user.userId
    );

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return res.status(404).json({ error: 'Flight not found' });
      }
      if (result.reason === 'invalid_token') {
        return res.status(403).json({ error: 'Invalid claim token' });
      }
      if (result.reason === 'already_claimed') {
        return res.status(409).json({ error: 'Flight already claimed' });
      }
      return res.status(400).json({ error: 'Unable to claim flight' });
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to claim flight' });
  }
});

// GET: /api/flights/:sessionId/:flightId/acars-flight - get specific flight for ACARS token
router.get(
  '/:sessionId/:flightId/acars-flight',
  acarsValidationLimiter,
  async (req, res) => {
    try {
      const { sessionId, flightId } = req.params;
      const acarsToken =
        typeof req.query.acars_token === 'string'
          ? req.query.acars_token
          : undefined;

      if (!acarsToken) {
        return res.status(400).json({ error: 'Missing access token' });
      }

      const validation = await validateAcarsAccess(sessionId, flightId, acarsToken);
      if (!validation.valid) {
        return res.status(403).json({ error: 'Invalid ACARS token' });
      }

      const flight = await getFlightById(sessionId, flightId);
      if (!flight) {
        return res.status(404).json({ error: 'Flight not found' });
      }

      const { user_id, ip_address, acars_token, ...sanitizedFlight } = flight;
      void user_id;
      void ip_address;
      void acars_token;
      res.json(sanitizedFlight);
    } catch {
      res.status(500).json({ error: 'Failed to load flight' });
    }
  }
);

// GET: /api/flights/:sessionId - get all flights for a session
router.get('/:sessionId', requireAuth, async (req, res) => {
  try {
    const flights = await getFlightsBySession(req.params.sessionId);
    res.json(flights);
  } catch {
    res.status(500).json({ error: 'Failed to fetch flights' });
  }
});

// POST: /api/flights/:sessionId - add a flight to a session (for submit page and external access)
router.post('/:sessionId', flightCreationLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body.callsign) {
      try {
        req.body.callsign = validateCallsign(req.body.callsign);
      } catch (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid callsign' });
      }
    }

    const flightData = {
      ...req.body,
      user_id: req.user?.userId,
      ip_address: getClientIp(req),
    };

    const flight = await addFlight(req.params.sessionId, flightData);

    await recordNewFlight();

    const sanitizedFlight = flight
      ? Object.fromEntries(
          Object.entries(flight).filter(
            ([k]) => !['acars_token', 'user_id', 'ip_address'].includes(k)
          )
        )
      : {};
    broadcastFlightEvent(
      req.params.sessionId,
      'flightAdded',
      sanitizedFlight
    );
    res.status(201).json(flight);
  } catch (err) {
    console.error('Failed to add flight:', err);
    res.status(500).json({ error: 'Failed to add flight' });
  }
});

// PUT: /api/flights/:sessionId/:flightId - update a flight (for external access/fallback)
router.put(
  '/:sessionId/:flightId',
  requireAuth,
  requireFlightAccess,
  async (req, res) => {
    try {
      if (req.body.callsign) {
        try {
          req.body.callsign = validateCallsign(req.body.callsign);
        } catch (err) {
          return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid callsign' });
        }
      }
      
      if (req.body.stand && req.body.stand.length > 8) {
        return res.status(400).json({ error: 'Stand too long' });
      }
      const flight = await updateFlight(
        req.params.sessionId,
        req.params.flightId,
        req.body
      );
      if (!flight) {
        return res.status(404).json({ error: 'Flight not found' });
      }

      broadcastFlightEvent(req.params.sessionId, 'flightUpdated', flight);

      res.json(flight);
    } catch {
      res.status(500).json({ error: 'Failed to update flight' });
    }
  }
);

// DELETE: /api/flights/:sessionId/:flightId - delete a flight (for external access/fallback)
router.delete(
  '/:sessionId/:flightId',
  requireAuth,
  requireFlightAccess,
  async (req, res) => {
    try {
      await deleteFlight(req.params.sessionId, req.params.flightId);

      broadcastFlightEvent(req.params.sessionId, 'flightDeleted', {
        flightId: req.params.flightId,
      });

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete flight' });
    }
  }
);

// GET: /api/flights/:sessionId/:flightId/validate-acars - validate ACARS access token
router.get(
  '/:sessionId/:flightId/validate-acars',
  acarsValidationLimiter,
  async (req, res) => {
    try {
      const { sessionId, flightId } = req.params;
      const acarsToken =
        typeof req.query.acars_token === 'string'
          ? req.query.acars_token
          : undefined;

      if (!acarsToken) {
        return res
          .status(400)
          .json({ valid: false, error: 'Missing access token' });
      }

      const result = await validateAcarsAccess(sessionId, flightId, acarsToken);
      res.json(result);
    } catch {
      res.status(500).json({ valid: false, error: 'Validation failed' });
    }
  }
);

// POST: /api/flights/acars/active - mark ACARS terminal as active
router.post('/acars/active', acarsValidationLimiter, async (req, res) => {
  try {
    const { sessionId, flightId, acarsToken } = req.body;

    if (!sessionId || !flightId || !acarsToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await validateAcarsAccess(sessionId, flightId, acarsToken);
    if (!result.valid) {
      return res.status(403).json({ error: 'Invalid ACARS token' });
    }

    const key = `${sessionId}:${flightId}`;
    activeAcarsTerminals.set(key, {
      sessionId,
      flightId,
      connectedAt: new Date().toISOString(),
      lastSeen: Date.now(),
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark ACARS as active' });
  }
});

// DELETE: /api/flights/acars/active/:sessionId/:flightId - mark ACARS terminal as inactive
router.delete('/acars/active/:sessionId/:flightId', async (req, res) => {
  try {
    const { sessionId, flightId } = req.params;
    const key = `${sessionId}:${flightId}`;

    activeAcarsTerminals.delete(key);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark ACARS as inactive' });
  }
});

// GET: /api/flights/acars/active - get all active ACARS terminals
router.get('/acars/active', async (req, res) => {
  try {
    interface ActiveFlight {
      [key: string]: unknown;
    }
    const activeFlights: ActiveFlight[] = [];

    for (const [
      key,
      terminal,
    ] of activeAcarsTerminals.entries()) {
      const { sessionId, flightId } = terminal;
      
      // Update last seen
      terminal.lastSeen = Date.now();
      
      try {
        const result = await mainDb
          .selectFrom('flights')
          .selectAll()
          .where('session_id', '=', sessionId)
          .where('id', '=', flightId)
          .execute();

        if (result.length > 0) {
          activeFlights.push(result[0]);
        }
      } catch {
        activeAcarsTerminals.delete(key);
      }
    }

    const userIds = [
      ...new Set(activeFlights.map((f) => f.user_id).filter(Boolean)),
    ];
    const usersMap = new Map();

    if (userIds.length > 0) {
      try {
        const users = await mainDb
          .selectFrom('users')
          .select([
            'id',
            'username as discord_username',
            'avatar as discord_avatar_url',
          ])
          .where('id', 'in', userIds as string[])
          .execute();

        users.forEach((user) => {
          usersMap.set(user.id, {
            discord_username: user.discord_username,
            discord_avatar_url: user.discord_avatar_url
              ? `https://cdn.discordapp.com/avatars/${user.id}/${user.discord_avatar_url}.png`
              : null,
          });
        });
      } catch {
        // ignore user fetch errors
      }
    }

    interface SanitizedFlight {
      [key: string]: unknown;
      user?: {
        discord_username: string;
        discord_avatar_url: string | null;
      };
    }

    const enrichedFlights = activeFlights.map(
      (flight: Record<string, unknown>) => {
        const { user_id, ip_address, acars_token, ...sanitizedFlight } = flight;

        if (user_id && usersMap.has(user_id)) {
          (sanitizedFlight as SanitizedFlight).user = usersMap.get(user_id);
        }

        return sanitizedFlight as SanitizedFlight;
      }
    );

    res.json(enrichedFlights);
  } catch {
    res.status(500).json({ error: 'Failed to fetch active ACARS terminals' });
  }
});

export default router;