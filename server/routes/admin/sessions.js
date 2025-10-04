import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { getAdminSessions } from '../../db/admin.js';

const router = express.Router();

// GET: /api/admin/sessions - Get all sessions with details
router.get('/', createAuditLogger('ADMIN_SESSIONS_ACCESSED'), async (req, res) => {
    try {
        const sessions = await getAdminSessions();
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

export default router;