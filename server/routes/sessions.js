import express from 'express';
import {
    initializeSessionsTable,
    createSession,
    getSessionById,
    getSessionsByUser,
    updateSession,
    deleteSession,
    getAllSessions,
    encrypt,
    decrypt,
    updateSessionName,
    getSessionsByUserDetailed
} from '../db/sessions.js';
import { generateSessionId, generateAccessId } from '../tools/ids.js';
import { verifyToken } from './auth.js';

const router = express.Router();
initializeSessionsTable();

// Create new session
router.post('/create', async (req, res) => {
    try {
        const { airportIcao, createdBy, isPFATC = false, activeRunway = null } = req.body;
        if (!airportIcao || !createdBy) {
            return res.status(400).json({ error: 'Airport ICAO and creator ID are required' });
        }
        const sessionId = generateSessionId();
        const accessId = generateAccessId();

        const existing = await getSessionById(sessionId);
        if (existing) {
            return router.post('/create')(req, res);
        }

        await createSession({ sessionId, accessId, activeRunway, airportIcao, createdBy, isPFATC });
        res.status(201).json({
            sessionId,
            accessId,
            activeRunway,
            airportIcao: airportIcao.toUpperCase(),
            createdBy,
            isPFATC,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to create session' });
    }
});

// Get user's sessions
router.get('/mine', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const sessions = await getSessionsByUserDetailed(userId);
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching user sessions:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch user sessions' });
    }
});

router.get('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const flightStrips = decrypt(JSON.parse(session.flight_strips));
        const atis = decrypt(JSON.parse(session.atis));
        res.json({
            sessionId: session.session_id,
            accessId: session.access_id,
            activeRunway: session.active_runway,
            airportIcao: session.airport_icao,
            createdAt: session.created_at,
            createdBy: session.created_by,
            isPFATC: session.is_pfatc,
            flightStrips: flightStrips || [],
            atis: atis || { letter: 'A', text: '', timestamp: new Date().toISOString() }
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch session' });
    }
});

router.put('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { activeRunway, flightStrips, atis } = req.body;
        const session = await updateSession(sessionId, { activeRunway, flightStrips, atis });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const decryptedFlightStrips = decrypt(JSON.parse(session.flight_strips));
        const decryptedAtis = decrypt(JSON.parse(session.atis));
        res.json({
            sessionId: session.session_id,
            accessId: session.access_id,
            activeRunway: session.active_runway,
            airportIcao: session.airport_icao,
            createdAt: session.created_at,
            createdBy: session.created_by,
            isPFATC: session.is_pfatc,
            flightStrips: decryptedFlightStrips || [],
            atis: decryptedAtis || { letter: 'A', text: '', timestamp: new Date().toISOString() }
        });
    } catch (error) {
        console.error('Error updating session:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to update session' });
    }
});

// Rename session
router.post('/update-name', verifyToken, async (req, res) => {
    try {
        const { sessionId, name } = req.body;
        if (!sessionId || typeof name !== 'string' || name.length > 50) {
            return res.status(400).json({ error: 'Invalid sessionId or name' });
        }
        const customName = await updateSessionName(sessionId, name.trim());
        if (!customName) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json({ customName });
    } catch (error) {
        console.error('Error updating session name:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to update session name' });
    }
});

// Delete session (POST for compatibility)
router.post('/delete', verifyToken, async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }
        const deleted = await deleteSession(sessionId);
        if (!deleted) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json({ message: 'Session deleted successfully', sessionId });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to delete session' });
    }
});

router.get('/', async (req, res) => {
    try {
        const sessions = await getAllSessions();
        res.json(sessions.map(session => ({
            sessionId: session.session_id,
            airportIcao: session.airport_icao,
            createdAt: session.created_at,
            createdBy: session.created_by,
            isPFATC: session.is_pfatc,
            activeRunway: session.active_runway
        })));
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch sessions' });
    }
});

export default router;