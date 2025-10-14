import express from 'express';
import requireAuth from '../middleware/isAuthenticated.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { getFlightsBySession, addFlight, updateFlight, deleteFlight, validateAcarsAccess } from '../db/flights.js';
import { broadcastFlightEvent } from '../websockets/flightsWebsocket.js';
import { recordNewFlight } from '../db/statistics.js';
import { getClientIp } from '../tools/getIpAddress.js';
import flightsPool from '../db/connections/flightsConnection.js';
import pool from '../db/connections/connection.js';
import { flightCreationLimiter, acarsValidationLimiter } from '../middleware/rateLimiting.js';

const router = express.Router();

const activeAcarsTerminals = new Map();

// GET: /api/flights/:sessionId - get all flights for a session
router.get('/:sessionId', requireAuth, async (req, res) => {
    try {
        const flights = await getFlightsBySession(req.params.sessionId);
        res.json(flights);
    } catch (error) {
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

        const { acars_token, user_id, ip_address, ...sanitizedFlight } = flight;
        broadcastFlightEvent(req.params.sessionId, 'flightAdded', sanitizedFlight);
        res.status(201).json(flight);
    } catch (error) {
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
    } catch (error) {
        res.status(500).json({ error: 'Failed to update flight' });
    }
});

// DELETE: /api/flights/:sessionId/:flightId - delete a flight (for external access/fallback)
router.delete('/:sessionId/:flightId', requireAuth, async (req, res) => {
    try {
        await deleteFlight(req.params.sessionId, req.params.flightId);

        broadcastFlightEvent(req.params.sessionId, 'flightDeleted', { flightId: req.params.flightId });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete flight' });
    }
});

// GET: /api/flights/:sessionId/:flightId/validate-acars - validate ACARS access token
router.get('/:sessionId/:flightId/validate-acars', acarsValidationLimiter, async (req, res) => {
    try {
        const { sessionId, flightId } = req.params;
        const acarsToken = req.query.accessId;

        if (!acarsToken) {
            return res.status(400).json({ valid: false, error: 'Missing access token' });
        }

        const result = await validateAcarsAccess(sessionId, flightId, acarsToken);
        res.json(result);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark ACARS as inactive' });
    }
});

// GET: /api/flights/acars/active - get all active ACARS terminals
router.get('/acars/active', async (req, res) => {
    try {
        const activeFlights = [];

        for (const [key, { sessionId, flightId }] of activeAcarsTerminals.entries()) {
            try {
                const tableName = `flights_${sessionId}`;
                const result = await flightsPool.query(
                    `SELECT * FROM ${tableName} WHERE id = $1`,
                    [flightId]
                );

                if (result.rows.length > 0) {
                    activeFlights.push(result.rows[0]);
                }
            } catch (error) {
                activeAcarsTerminals.delete(key);
            }
        }

        // Fetch user data for all active flights
        const userIds = [...new Set(activeFlights.map(f => f.user_id).filter(Boolean))];
        let usersMap = new Map();

        if (userIds.length > 0) {
            try {
                const usersResult = await pool.query(
                    `SELECT id, username as discord_username, avatar as discord_avatar_url
                     FROM users
                     WHERE id = ANY($1)`,
                    [userIds]
                );

                usersResult.rows.forEach(user => {
                    usersMap.set(user.id, {
                        discord_username: user.discord_username,
                        discord_avatar_url: user.discord_avatar_url
                            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.discord_avatar_url}.png`
                            : null
                    });
                });
            } catch (userError) {
                console.error('Error fetching user data for active ACARS:', userError);
            }
        }

        // Enrich flights with user data
        const enrichedFlights = activeFlights.map(flight => {
            const { user_id, ip_address, acars_token, ...sanitizedFlight } = flight;

            if (flight.user_id && usersMap.has(flight.user_id)) {
                sanitizedFlight.user = usersMap.get(flight.user_id);
            }

            return sanitizedFlight;
        });

        res.json(enrichedFlights);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch active ACARS terminals' });
    }
});

export default router;