import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { getAdminSessions } from '../../db/admin.js';
import {
  deleteSession,
  getSessionById,
  updateSession,
  ExclusiveSessionNetworkFlagsError,
} from '../../db/sessions.js';
import { isDeveloperKeyActiveWithScope } from '../../db/developer.js';
import { mainDb, redisConnection } from '../../db/connection.js';
import { keys } from '../../realtime/keys.js';
import { DEPLOYMENT } from '../../utils/cacheTtl.js';
import { sanitizeAlphanumeric } from '../../utils/sanitization.js';
import { validateSessionId } from '../../utils/validation.js';
import {
  isValidAirportIcao,
  isValidRunwayForAirport,
} from '../../utils/flightUtils.js';
import {
  SESSION_CLAIM_SCOPE_ID,
  forceReleaseExternalAcarsClaim,
  getExternalAcarsClaims,
} from '../../utils/externalAcarsClaims.js';
import { broadcastFlightEvent } from '../../websockets/flightsWebsocket.js';

const router = express.Router();

router.use(requirePermission('sessions'));

type AdminSessionClaim = {
  keyId: string;
  keyName: string | null;
  userId: string;
  username: string | null;
  claimedAt: string;
  expiresAt: string;
  active: boolean;
};

async function loadClaimsForSessions(
  sessionIds: string[]
): Promise<Map<string, AdminSessionClaim>> {
  const out = new Map<string, AdminSessionClaim>();
  let claims;
  try {
    claims = await getExternalAcarsClaims(sessionIds);
  } catch (error) {
    console.error('Error loading external ACARS claims:', error);
    return out;
  }
  if (claims.size === 0) return out;

  const keyIds = [...new Set([...claims.values()].map((c) => c.keyId))];
  const keyRows = await mainDb
    .selectFrom('developer_api_keys as k')
    .leftJoin('users as u', 'k.user_id', 'u.id')
    .select(['k.id', 'k.name', 'u.username'])
    .where('k.id', 'in', keyIds)
    .execute();
  const keyInfo = new Map(keyRows.map((r) => [String(r.id), r]));
  const activeByKey = new Map(
    await Promise.all(
      keyIds.map(
        async (id) =>
          [
            id,
            await isDeveloperKeyActiveWithScope(id, SESSION_CLAIM_SCOPE_ID),
          ] as const
      )
    )
  );

  for (const [sessionId, c] of claims) {
    const info = keyInfo.get(c.keyId);
    out.set(sessionId, {
      keyId: c.keyId,
      keyName: info?.name ?? null,
      userId: c.userId,
      username: info?.username ?? null,
      claimedAt: c.claimedAt,
      expiresAt: c.expiresAt,
      active: activeByKey.get(c.keyId) ?? false,
    });
  }
  return out;
}

const SESSION_TYPES = ['standard', 'pfatc', 'advanced_atc'] as const;
type SessionType = (typeof SESSION_TYPES)[number];

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
      const claims = await loadClaimsForSessions(
        result.sessions.map((s) => s.session_id)
      );
      res.json({
        ...result,
        sessions: result.sessions.map((s) => ({
          ...s,
          external_claim: claims.get(s.session_id) ?? null,
        })),
      });
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

router.patch(
  '/:sessionId',
  createAuditLogger('SESSION_UPDATED'),
  async (req, res) => {
    try {
      let sessionId: string;
      try {
        sessionId = validateSessionId(req.params.sessionId);
      } catch {
        return res.status(400).json({ error: 'Invalid session ID' });
      }
      const current = await getSessionById(sessionId);
      if (!current) return res.status(404).json({ error: 'Session not found' });

      const body = (req.body ?? {}) as Record<string, unknown>;
      const updates: Parameters<typeof updateSession>[1] = {};

      if (body.type !== undefined) {
        if (!SESSION_TYPES.includes(body.type as SessionType)) {
          return res.status(400).json({
            error: `type must be one of: ${SESSION_TYPES.join(', ')}`,
          });
        }
        updates.is_pfatc = body.type === 'pfatc';
        updates.is_advanced_atc = body.type === 'advanced_atc';
      }

      let airport = current.airport_icao;
      if (body.airportIcao !== undefined) {
        if (!isValidAirportIcao(body.airportIcao)) {
          return res
            .status(400)
            .json({ error: `Unknown airport ICAO: "${body.airportIcao}"` });
        }
        airport = String(body.airportIcao).trim().toUpperCase();
        updates.airport_icao = airport;
      }

      const airportChanged = airport !== current.airport_icao;
      const runwayField = (
        field: 'activeRunway' | 'arrivalRunway',
        existing: string | null | undefined
      ): { value?: string | null; error?: string } => {
        const raw = body[field];
        if (raw === undefined) {
          if (
            airportChanged &&
            existing &&
            !isValidRunwayForAirport(airport, existing)
          ) {
            return {
              error: `Runway ${existing} does not exist at ${airport}; choose a new ${field}.`,
            };
          }
          return {};
        }
        if (raw === null || raw === '') {
          return field === 'arrivalRunway'
            ? { value: null }
            : { error: 'activeRunway is required' };
        }
        if (!isValidRunwayForAirport(airport, raw)) {
          return { error: `"${raw}" is not a runway at ${airport}` };
        }
        return { value: String(raw).trim().toUpperCase() };
      };

      const active = runwayField('activeRunway', current.active_runway);
      if (active.error) return res.status(400).json({ error: active.error });
      if (active.value) updates.active_runway = active.value;

      const arrival = runwayField('arrivalRunway', current.arrival_runway);
      if (arrival.error) return res.status(400).json({ error: arrival.error });
      if (arrival.value !== undefined) updates.arrival_runway = arrival.value;

      if (body.customName !== undefined) {
        if (
          typeof body.customName !== 'string' ||
          body.customName.length > 50
        ) {
          return res.status(400).json({ error: 'Invalid custom name' });
        }
        updates.custom_name = sanitizeAlphanumeric(body.customName, 50);
      }

      if (body.feedbackEnabled !== undefined) {
        if (typeof body.feedbackEnabled !== 'boolean') {
          return res
            .status(400)
            .json({ error: 'feedbackEnabled must be a boolean' });
        }
        updates.feedback_enabled = body.feedbackEnabled;
      }

      if (body.externalSession !== undefined) {
        if (
          body.externalSession !== null &&
          typeof body.externalSession !== 'boolean'
        ) {
          return res
            .status(400)
            .json({ error: 'externalSession must be a boolean or null' });
        }
        updates.external_session = body.externalSession;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No editable fields provided' });
      }

      const updated = await updateSession(sessionId, updates);
      if (!updated) return res.status(404).json({ error: 'Session not found' });

      await redisConnection
        .del(keys.userSessions(updated.created_by))
        .catch(() => {});
      broadcastFlightEvent(sessionId, 'sessionUpdated', {
        activeRunway: updated.active_runway,
        feedbackEnabled: updated.feedback_enabled ?? true,
      });

      res.json({
        session_id: updated.session_id,
        airport_icao: updated.airport_icao,
        active_runway: updated.active_runway,
        arrival_runway: updated.arrival_runway ?? null,
        is_pfatc: Boolean(updated.is_pfatc),
        is_advanced_atc: Boolean(updated.is_advanced_atc),
        custom_name: updated.custom_name ?? null,
        feedback_enabled: updated.feedback_enabled ?? true,
        external_session: updated.external_session ?? null,
      });
    } catch (error) {
      if (error instanceof ExclusiveSessionNetworkFlagsError) {
        return res.status(400).json({ error: 'Invalid session type' });
      }
      console.error('Error updating session:', error);
      res.status(500).json({ error: 'Failed to update session' });
    }
  }
);

router.delete(
  '/:sessionId/claim',
  createAuditLogger('SESSION_CLAIM_RELEASED'),
  async (req, res) => {
    try {
      let sessionId: string;
      try {
        sessionId = validateSessionId(req.params.sessionId);
      } catch {
        return res.status(400).json({ error: 'Invalid session ID' });
      }
      const released = await forceReleaseExternalAcarsClaim(sessionId);
      if (!released) {
        return res.status(404).json({ error: 'Session is not claimed' });
      }
      res.json({ message: 'Claim released', sessionId });
    } catch (error) {
      console.error('Error releasing session claim:', error);
      res.status(500).json({ error: 'Failed to release claim' });
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
      aatcEventMode: false, // AATC disabled — was: row?.aatc_event_mode ?? false
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
      const { pfatcEventMode /*, aatcEventMode */ } = req.body as {
        pfatcEventMode?: boolean;
        // aatcEventMode?: boolean; // AATC disabled
      };

      const updates: Record<string, boolean> = {};
      if (typeof pfatcEventMode === 'boolean')
        updates.pfatc_event_mode = pfatcEventMode;
      // AATC disabled — aatcEventMode update removed
      // if (typeof aatcEventMode === 'boolean') updates.aatc_event_mode = aatcEventMode;

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
        aatcEventMode: false, // AATC disabled — was: row?.aatc_event_mode ?? false
      });
    } catch (error) {
      console.error('Error updating event mode:', error);
      res.status(500).json({ error: 'Failed to update event mode' });
    }
  }
);

export default router;
