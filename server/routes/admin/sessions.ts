import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { getAdminSessions } from '../../db/admin.js';
import { deleteSession } from '../../db/sessions.js';
import { mainDb } from '../../db/connection.js';
import { DEPLOYMENT } from '../../utils/cacheTtl.js';

const router = express.Router();

router.use(requirePermission('sessions'));

// GET: /api/admin/sessions - Get all sessions with details
router.get(
  '/',
  createAuditLogger('ADMIN_SESSIONS_ACCESSED'),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
      const search = (req.query.search as string) || '';
      const result = await getAdminSessions(page, limit, search);
      res.json(result);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  }
);

// DELETE: /api/admin/sessions/:sessionId - Delete a session
router.delete(
  '/:sessionId',
  createAuditLogger('SESSION_DELETED'),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      await deleteSession(sessionId);
      res.json({ message: 'Session deleted successfully', sessionId });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string' &&
        (error as { message: string }).message.includes('not found')
      ) {
        return res.status(404).json({ error: 'Session not found' });
      }
      console.error('Error deleting session:', error);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  }
);

// POST: /api/admin/sessions/:sessionId/join - Log joining a session
router.post(
  '/:sessionId/join',
  createAuditLogger('SESSION_JOINED'),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      res.json({ message: 'Session join logged successfully', sessionId });
    } catch (error) {
      console.error('Error logging session join:', error);
      res.status(500).json({ error: 'Failed to log session join' });
    }
  }
);

// GET: /api/admin/sessions/event-mode - Get current event mode state
router.get('/event-mode', async (_req, res) => {
  try {
    const row = await mainDb
      .selectFrom('app_settings')
      .select(['pfatc_event_mode', 'aatc_event_mode'])
      .where('channel', '=', DEPLOYMENT)
      .executeTakeFirst();

    res.json({
      pfatcEventMode: row?.pfatc_event_mode ?? false,
      aatcEventMode: row?.aatc_event_mode ?? false,
    });
  } catch (error) {
    console.error('Error fetching event mode:', error);
    res.status(500).json({ error: 'Failed to fetch event mode' });
  }
});

// POST: /api/admin/sessions/event-mode - Update event mode state
router.post(
  '/event-mode',
  createAuditLogger('EVENT_MODE_UPDATED'),
  async (req, res) => {
    try {
      const { pfatcEventMode, aatcEventMode } = req.body as {
        pfatcEventMode?: boolean;
        aatcEventMode?: boolean;
      };

      const updates: Record<string, boolean> = {};
      if (typeof pfatcEventMode === 'boolean')
        updates.pfatc_event_mode = pfatcEventMode;
      if (typeof aatcEventMode === 'boolean')
        updates.aatc_event_mode = aatcEventMode;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided' });
      }

      await mainDb
        .updateTable('app_settings')
        .set(updates)
        .where('channel', '=', DEPLOYMENT)
        .execute();

      const row = await mainDb
        .selectFrom('app_settings')
        .select(['pfatc_event_mode', 'aatc_event_mode'])
        .where('channel', '=', DEPLOYMENT)
        .executeTakeFirst();

      res.json({
        pfatcEventMode: row?.pfatc_event_mode ?? false,
        aatcEventMode: row?.aatc_event_mode ?? false,
      });
    } catch (error) {
      console.error('Error updating event mode:', error);
      res.status(500).json({ error: 'Failed to update event mode' });
    }
  }
);

export default router;
