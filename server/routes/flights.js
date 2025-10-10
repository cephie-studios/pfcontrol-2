import express from 'express';
import requireAuth from '../middleware/isAuthenticated.js';
import { getFlightsBySession, addFlight, updateFlight, deleteFlight, validateAcarsAccess } from '../db/flights.js';
import { broadcastFlightEvent } from '../websockets/flightsWebsocket.js';
import { recordNewFlight } from '../db/statistics.js';
import { getClientIp } from '../tools/getIpAddress.js';
import flightsPool from '../db/connections/flightsConnection.js';

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
router.post('/:sessionId', async (req, res) => {
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
router.get('/:sessionId/:flightId/validate-acars', async (req, res) => {
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
router.post('/acars/active', async (req, res) => {
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
                    `SELECT id, callsign, departure, arrival, aircraft, session_id FROM ${tableName} WHERE id = $1`,
                    [flightId]
                );

                if (result.rows.length > 0) {
                    activeFlights.push(result.rows[0]);
                }
            } catch (error) {
                activeAcarsTerminals.delete(key);
            }
        }

        res.json(activeFlights);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch active ACARS terminals' });
    }
});

export default router;