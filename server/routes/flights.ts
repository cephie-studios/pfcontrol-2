import express from 'express';
import requireAuth from '../middleware/auth.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { getFlightsBySession, addFlight, updateFlight, deleteFlight, validateAcarsAccess } from '../db/flights';
import { broadcastFlightEvent } from '../websockets/flightsWebsocket';
import { recordNewFlight } from '../db/statistics';
import { getClientIp } from '../utils/getIpAddress';
import { mainDb, flightsDb } from '../db/connection';
import { flightCreationLimiter, acarsValidationLimiter } from '../middleware/rateLimiting';

const router = express.Router();

const activeAcarsTerminals = new Map();

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
router.post('/:sessionId', optionalAuth, flightCreationLimiter, async (req, res) => {
    try {
        const flightData = {
            ...req.body,
            user_id: req.user?.userId,
            ip_address: getClientIp(req)
        };

        const flight = await addFlight(req.params.sessionId, flightData);

        await recordNewFlight();

    // Remove sensitive fields before broadcasting
    const sanitizedFlight = flight ? Object.fromEntries(Object.entries(flight).filter(([k]) => !['acars_token', 'user_id', 'ip_address'].includes(k))) : {};
    broadcastFlightEvent(req.params.sessionId, 'flightAdded', sanitizedFlight);
        res.status(201).json(flight);
    } catch {
        res.status(500).json({ error: 'Failed to add flight' });
    }
});

// PUT: /api/flights/:sessionId/:flightId - update a flight (for external access/fallback)
router.put('/:sessionId/:flightId', requireAuth, async (req, res) => {
    try {
        if (req.body.callsign && req.body.callsign.length > 16) {
            return res.status(400).json({ error: 'Callsign too long' });
        }
        if (req.body.stand && req.body.stand.length > 8) {
            return res.status(400).json({ error: 'Stand too long' });
        }
        const flight = await updateFlight(req.params.sessionId, req.params.flightId, req.body);
        if (!flight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        broadcastFlightEvent(req.params.sessionId, 'flightUpdated', flight);

        res.json(flight);
    } catch {
        res.status(500).json({ error: 'Failed to update flight' });
    }
});

// DELETE: /api/flights/:sessionId/:flightId - delete a flight (for external access/fallback)
router.delete('/:sessionId/:flightId', requireAuth, async (req, res) => {
    try {
        await deleteFlight(req.params.sessionId, req.params.flightId);

        broadcastFlightEvent(req.params.sessionId, 'flightDeleted', { flightId: req.params.flightId });

        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Failed to delete flight' });
    }
});

// GET: /api/flights/:sessionId/:flightId/validate-acars - validate ACARS access token
router.get('/:sessionId/:flightId/validate-acars', acarsValidationLimiter, async (req, res) => {
    try {
        const { sessionId, flightId } = req.params;
        const acarsToken = typeof req.query.accessId === 'string' ? req.query.accessId : undefined;

        if (!acarsToken) {
            return res.status(400).json({ valid: false, error: 'Missing access token' });
        }

        const result = await validateAcarsAccess(sessionId, flightId, acarsToken);
        res.json(result);
    } catch {
        res.status(500).json({ valid: false, error: 'Validation failed' });
    }
});

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
            connectedAt: new Date().toISOString()
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

        for (const [key, { sessionId, flightId }] of activeAcarsTerminals.entries()) {
            try {
                const tableName = `flights_${sessionId}`;
                const result = await flightsDb
                    .selectFrom(tableName)
                    .selectAll()
                    .where('id', '=', flightId)
                    .execute();

                if (result.length > 0) {
                    activeFlights.push(result[0]);
                }
            } catch {
                activeAcarsTerminals.delete(key);
            }
        }

        const userIds = [...new Set(activeFlights.map(f => f.user_id).filter(Boolean))];
        const usersMap = new Map();

        if (userIds.length > 0) {
            try {
                const users = await mainDb
                    .selectFrom('users')
                    .select(['id', 'username as discord_username', 'avatar as discord_avatar_url'])
                    .where('id', 'in', userIds as string[])
                    .execute();

                users.forEach(user => {
                    usersMap.set(user.id, {
                        discord_username: user.discord_username,
                        discord_avatar_url: user.discord_avatar_url
                            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.discord_avatar_url}.png`
                            : null
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

        const enrichedFlights = activeFlights.map((flight: Record<string, unknown>) => {
            const { user_id, ip_address, acars_token, ...sanitizedFlight } = flight;

            if (user_id && usersMap.has(user_id)) {
                (sanitizedFlight as SanitizedFlight).user = usersMap.get(user_id);
            }

            return sanitizedFlight as SanitizedFlight;
        });

        res.json(enrichedFlights);
    } catch {
        res.status(500).json({ error: 'Failed to fetch active ACARS terminals' });
    }
});

export default router;