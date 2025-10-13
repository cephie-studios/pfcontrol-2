import express from 'express';
import {
    initializeSessionsTable,
    createSession,
    getSessionById,
    updateSession,
    deleteSession,
    getAllSessions,
    decrypt,
    updateSessionName,
    getSessionsByUserDetailed
} from '../db/sessions.js';
import { addSessionToUser } from '../db/users.js';
import { generateSessionId, generateAccessId } from '../tools/ids.js';
import { recordNewSession } from '../db/statistics.js';
import { requireSessionAccess, requireSessionOwnership } from '../middleware/sessionAccess.js';
import { getSessionsByUser } from '../db/sessions.js';
import requireAuth from '../middleware/isAuthenticated.js';
import { sessionCreationLimiter } from '../middleware/rateLimiting.js';
import { sanitizeAlphanumeric } from '../utils/sanitization.js';

const router = express.Router();
initializeSessionsTable();

// POST: /api/sessions/create - Create new session
router.post('/create', sessionCreationLimiter, requireAuth, async (req, res) => {
    try {
        const { airportIcao, createdBy, isPFATC = false, activeRunway = null } = req.body;
        if (!airportIcao || !createdBy) {
            return res.status(400).json({ error: 'Airport ICAO and creator ID are required' });
        }

        const userSessions = await getSessionsByUser(createdBy);
        if (userSessions.length >= 10) {
            return res.status(400).json({
                error: 'Session limit reached',
                message: 'You can only have 10 active sessions. Please delete an old session first.',
                sessionCount: userSessions.length,
                maxSessions: 10
            });
        }

        const sessionId = generateSessionId();
        const accessId = generateAccessId();

        const existing = await getSessionById(sessionId);
        if (existing) {
            return router.post('/create')(req, res);
        }

        await createSession({ sessionId, accessId, activeRunway, airportIcao, createdBy, isPFATC });

        await addSessionToUser(createdBy, sessionId);

        await recordNewSession();

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

// GET: /api/sessions/mine - Get user's sessions
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId;
        const sessions = await getSessionsByUserDetailed(userId);
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching user sessions:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch user sessions' });
    }
});

// GET: /api/sessions/:sessionId/submit - Get basic session info for submit page (public)
router.get('/:sessionId/submit', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({
            sessionId: session.session_id,
            airportIcao: session.airport_icao,
            activeRunway: session.active_runway,
            isPFATC: session.is_pfatc
        });
    } catch (error) {
        console.error('Error fetching session for submit:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch session' });
    }
});

// GET: /api/sessions/:sessionId - Get session by ID
router.get('/:sessionId', requireSessionAccess, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const atis = decrypt(JSON.parse(session.atis));
        res.json({
            sessionId: session.session_id,
            accessId: session.access_id,
            activeRunway: session.active_runway,
            airportIcao: session.airport_icao,
            createdAt: session.created_at,
            createdBy: session.created_by,
            isPFATC: session.is_pfatc,
            atis: atis || { letter: 'A', text: '', timestamp: new Date().toISOString() }
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch session' });
    }
});

// PUT: /api/sessions/:sessionId - Update session
router.put('/:sessionId', requireSessionAccess, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { activeRunway, atis } = req.body;
        const session = await updateSession(sessionId, { activeRunway, atis });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const decryptedAtis = decrypt(JSON.parse(session.atis));
        res.json({
            sessionId: session.session_id,
            accessId: session.access_id,
            activeRunway: session.active_runway,
            airportIcao: session.airport_icao,
            createdAt: session.created_at,
            createdBy: session.created_by,
            isPFATC: session.is_pfatc,
            atis: decryptedAtis || { letter: 'A', text: '', timestamp: new Date().toISOString() }
        });
    } catch (error) {
        console.error('Error updating session:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to update session' });
    }
});

// POST: /api/sessions/update-name - Rename session
router.post('/update-name', requireAuth, requireSessionOwnership, async (req, res) => {
    try {
        const { sessionId, name } = req.body;
        if (!sessionId || typeof name !== 'string' || name.length > 50) {
            return res.status(400).json({ error: 'Invalid sessionId or name' });
        }
        const sanitizedName = sanitizeAlphanumeric(name, 50);
        const customName = await updateSessionName(sessionId, sanitizedName);
        if (!customName) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json({ customName });
    } catch (error) {
        console.error('Error updating session name:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to update session name' });
    }
});

// POST: /api/sessions/delete - Delete session (POST for compatibility)
router.post('/delete', requireAuth, async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        const session = await getSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.created_by !== req.user.userId) {
            return res.status(403).json({ error: 'You can only delete your own sessions' });
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

// POST: /api/sessions/delete-oldest - Delete user's oldest session
router.post('/delete-oldest', requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userSessions = await getSessionsByUser(userId);

        if (userSessions.length === 0) {
            return res.status(404).json({ error: 'No sessions found' });
        }

        const oldestSession = userSessions.sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
        )[0];

        const deleted = await deleteSession(oldestSession.session_id);
        if (!deleted) {
            return res.status(404).json({ error: 'Failed to delete oldest session' });
        }

        res.json({
            message: 'Oldest session deleted successfully',
            sessionId: oldestSession.session_id,
            airportIcao: oldestSession.airport_icao,
            createdAt: oldestSession.created_at
        });
    } catch (error) {
        console.error('Error deleting oldest session:', error);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to delete oldest session' });
    }
});

// GET: /api/sessions/ - Get all sessions
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