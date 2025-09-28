// routes/flights.js
import express from 'express';
import { getFlightsBySession, addFlight, updateFlight, deleteFlight } from '../db/flights.js';
import requireAuth from '../middleware/isAuthenticated.js';

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

// POST: /api/flights/:sessionId - add a flight to a session
router.post('/:sessionId', requireAuth, async (req, res) => {
    try {
        const flight = await addFlight(req.params.sessionId, req.body);
        res.status(201).json(flight);
    } catch (error) {
        console.error('Error adding flight:', error);
        res.status(500).json({ error: 'Failed to add flight' });
    }
});

// PUT: /api/flights/:sessionId/:flightId - update a flight
router.put('/:sessionId/:flightId', requireAuth, async (req, res) => {
    try {
        const flight = await updateFlight(req.params.sessionId, req.params.flightId, req.body);
        res.json(flight);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update flight' });
    }
});

// DELETE: /api/flights/:sessionId/:flightId - delete a flight
router.delete('/:sessionId/:flightId', requireAuth, async (req, res) => {
    try {
        await deleteFlight(req.params.sessionId, req.params.flightId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete flight' });
    }
});

export default router;