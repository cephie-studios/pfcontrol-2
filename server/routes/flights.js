import express from 'express';
import requireAuth from '../middleware/isAuthenticated.js';
import { getFlightsBySession, addFlight, updateFlight, deleteFlight } from '../db/flights.js';
import { broadcastFlightEvent } from '../websockets/flightsWebsocket.js';

const router = express.Router();

// GET: /api/flights/:sessionId - get all flights for a session
router.get('/:sessionId', requireAuth, async (req, res) => {
    try {
        const flights = await getFlightsBySession(req.params.sessionId);
        res.json(flights);
    } catch (error) {
        console.error('Error fetching flights:', error);
        res.status(500).json({ error: 'Failed to fetch flights' });
    }
});

// POST: /api/flights/:sessionId - add a flight to a session (for submit page and external access)
router.post('/:sessionId', requireAuth, async (req, res) => {
    try {
        const flight = await addFlight(req.params.sessionId, req.body);

        // Broadcast to websocket users
        broadcastFlightEvent(req.params.sessionId, 'flightAdded', flight);

        res.status(201).json(flight);
    } catch (error) {
        console.error('Error adding flight:', error);
        res.status(500).json({ error: 'Failed to add flight' });
    }
});

// PUT: /api/flights/:sessionId/:flightId - update a flight (for external access/fallback)
router.put('/:sessionId/:flightId', requireAuth, async (req, res) => {
    try {
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

export default router;