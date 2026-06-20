import express from 'express';
import {
  createSession,
  getSessionById,
  updateSession,
  deleteSession,
  getAllSessions,
  updateSessionName,
} from '../db/sessions.js';
import { ExclusiveSessionNetworkFlagsError } from '../utils/sessionNetworkFlags.js';
import { addSessionToUser, removeSessionFromUser } from '../db/users.js';
import { generateSessionId, generateAccessId } from '../utils/ids.js';
import { recordNewSession } from '../db/statistics.js';
import {
  requireSessionAccess,
  requireSessionOwnership,
} from '../middleware/sessionAccess.js';
import { getSessionsByUser } from '../db/sessions.js';
import { sessionCreationLimiter } from '../middleware/rateLimiting.js';
import { sanitizeAlphanumeric } from '../utils/sanitization.js';
import { getUserRoles } from '../db/roles.js';
import { isAdmin } from '../middleware/admin.js';
import { DEPLOYMENT } from '../utils/cacheTtl.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { getPublicSubmitSession } from '../services/publicSubmitSession.js';
import { Request, Response } from 'express';
import { JwtPayloadClient } from '../types/JwtPayload.js';
import requireAuth from '../middleware/auth.js';
import { capture } from '../utils/posthog.js';
import { sql } from 'kysely';
import { mainDb } from '../db/connection.js';
import { redisConnection } from '../db/connection.js';
import { keys, TTL } from '../realtime/keys.js';

async function invalidateUserSessionsCache(userId: string): Promise<void> {
  try {
    await redisConnection.del(keys.userSessions(userId));
  } catch {
    // ignore
  }
}

function isJwtPayloadClient(user: unknown): user is JwtPayloadClient {
  return (
    typeof user === 'object' &&
    user !== null &&
    'userId' in user &&
    typeof (user as Record<string, unknown>).userId === 'string'
  );
}

const router = express.Router();

// POST: /api/sessions/create - Create new session
router.post(
  '/create',
  sessionCreationLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!isJwtPayloadClient(user)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const createdBy = user.userId;
      const {
        airportIcao,
        isPFATC = false,
        isAdvancedATC = false,
        activeRunway = null,
        isTutorial = false,
      } = req.body;
      if (!airportIcao) {
        return res.status(400).json({ error: 'Airport ICAO is required' });
      }

      const pfatc = Boolean(isPFATC);
      const advancedAtc = false; // AATC disabled — was: Boolean(isAdvancedATC)
      if (isAdvancedATC) {
        return res.status(400).json({
          error: 'Network unavailable',
          message:
            'The Advanced ATC (AATC) network is not currently available.',
        });
      }
      if (pfatc && advancedAtc) {
        return res.status(400).json({
          error: 'Invalid session type',
          message:
            'Choose either PFATC Network or Advanced ATC Session, not both.',
        });
      }

      // Check event mode restrictions for PFATC sessions
      if ((pfatc || advancedAtc) && !isAdmin(createdBy)) {
        const eventModeRow = await mainDb
          .selectFrom('app_settings')
          .select(['pfatc_event_mode', 'aatc_event_mode'])
          .where('channel', '=', DEPLOYMENT)
          .executeTakeFirst();

        const userRolesForEvent = await getUserRoles(createdBy);

        const hasPfatcSector = userRolesForEvent.some((r) => {
          const p =
            typeof r.permissions === 'string'
              ? JSON.parse(r.permissions)
              : r.permissions;
          return p?.pfatc_sector === true;
        });

        // AATC disabled — aatc_sector check removed
        // const hasAatcSector = userRolesForEvent.some((r) => {
        //   const p = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions;
        //   return p?.aatc_sector === true;
        // });

        if (pfatc && eventModeRow?.pfatc_event_mode && !hasPfatcSector) {
          return res.status(403).json({
            error: 'Event mode active',
            message:
              'PFATC event mode is active. Only PFATC Event Controllers can create PFATC sessions.',
          });
        }

        // AATC disabled — aatc event mode check removed
        // if (advancedAtc && eventModeRow?.aatc_event_mode && !hasAatcSector) {
        //   return res.status(403).json({ error: 'Event mode active', message: 'AATC event mode is active.' });
        // }
      }

      const userSessions = await getSessionsByUser(createdBy);

      const userRoles = await getUserRoles(createdBy);
      const isTester =
        isAdmin(createdBy) ||
        userRoles.some(
          (role) =>
            role.name === 'Tester' ||
            role.name === 'Event Controller' ||
            (() => {
              const p =
                typeof role.permissions === 'string'
                  ? JSON.parse(role.permissions)
                  : role.permissions;
              return p?.pfatc_sector === true; // AATC disabled — was: || p?.aatc_sector === true
            })()
        );
      const maxSessions = isTester ? 100 : 50;

      if (userSessions.length >= maxSessions) {
        return res.status(400).json({
          error: 'Session limit reached',
          message: `You can only have ${maxSessions} active sessions. Please delete an old session first.`,
          sessionCount: userSessions.length,
          maxSessions,
        });
      }

      let sessionId = generateSessionId();
      const accessId = generateAccessId();

      const MAX_TRIES = 3;
      let attempt = 0;
      let existingSession = await getSessionById(sessionId);

      while (existingSession && attempt < MAX_TRIES - 1) {
        attempt++;
        sessionId = generateSessionId();
        existingSession = await getSessionById(sessionId);
      }

      if (existingSession) {
        return res
          .status(500)
          .json({ error: 'Session ID collision, please try again.' });
      }

      await createSession({
        sessionId,
        accessId,
        activeRunway,
        airportIcao,
        createdBy,
        isPFATC: pfatc,
        isAdvancedATC: advancedAtc,
        isTutorial,
      });

      await addSessionToUser(createdBy, sessionId);
      await invalidateUserSessionsCache(createdBy);

      await recordNewSession();

      capture(req, {
        distinctId: createdBy,
        event: 'session_created',
        properties: {
          session_id: sessionId,
          airport_icao: airportIcao,
          is_pfatc: pfatc,
          is_advanced_atc: advancedAtc,
          is_tutorial: isTutorial,
        },
      });

      res.status(201).json({
        sessionId,
        accessId,
        activeRunway,
        airportIcao: airportIcao.toUpperCase(),
        createdBy,
        isPFATC: pfatc,
        isAdvancedATC: advancedAtc,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ExclusiveSessionNetworkFlagsError) {
        return res.status(400).json({
          error: 'Invalid session type',
          message:
            'Choose either PFATC Network or Advanced ATC Session, not both.',
        });
      }
      console.error('Error creating session:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create session',
      });
    }
  }
);

// GET: /api/sessions/mine - Get sessions for the authenticated user
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cacheKey = keys.userSessions(userId);
    try {
      const cached = await redisConnection.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    } catch {
      // ignore cache errors
    }

    const sessions = await getSessionsByUser(userId);

    const sessionIds = sessions.map((s) => s.session_id);
    const flightCountMap = new Map<string, number>();

    if (sessionIds.length > 0) {
      const counts = await mainDb
        .selectFrom('flights')
        .select(['session_id', sql<number>`count(*)::int`.as('count')])
        .where('session_id', 'in', sessionIds)
        .groupBy('session_id')
        .execute();
      for (const row of counts) {
        flightCountMap.set(row.session_id, row.count);
      }
    }

    const result = sessions.map((session) => ({
      sessionId: session.session_id,
      accessId: session.access_id,
      airportIcao: session.airport_icao,
      createdAt: session.created_at,
      createdBy: session.created_by,
      isPFATC: session.is_pfatc,
      isAdvancedATC: session.is_advanced_atc,
      activeRunway: session.active_runway,
      customName: session.custom_name,
      flightCount: flightCountMap.get(session.session_id) ?? 0,
    }));

    try {
      await redisConnection.setex(
        cacheKey,
        TTL.USER_SESSIONS_SEC,
        JSON.stringify(result)
      );
    } catch {
      // ignore cache errors
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user sessions',
    });
  }
});

// GET: /api/sessions/:sessionId/submit - Get basic session info for submit page (public)
router.get('/:sessionId/submit', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getPublicSubmitSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching session for submit:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch session',
    });
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
    let atis = { letter: 'A', text: '', timestamp: new Date().toISOString() };
    if (session.atis) {
      try {
        const parsed =
          typeof session.atis === 'string'
            ? JSON.parse(session.atis)
            : session.atis;
        atis = decrypt(parsed);
      } catch (err) {
        console.error('Error decrypting ATIS:', err);
        // fallback to default atis
      }
    }
    res.json({
      sessionId: session.session_id,
      accessId: session.access_id,
      activeRunway: session.active_runway,
      airportIcao: session.airport_icao,
      createdAt: session.created_at,
      createdBy: session.created_by,
      isPFATC: session.is_pfatc,
      isAdvancedATC: session.is_advanced_atc,
      atis,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch session',
    });
  }
});

// PUT: /api/sessions/:sessionId - Update session
router.put('/:sessionId', requireSessionAccess, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { activeRunway, atis } = req.body;
    let encryptedAtis = undefined;
    if (atis) {
      const encrypted = encrypt(atis);
      encryptedAtis = JSON.stringify(encrypted);
    }

    let session;
    try {
      session = await updateSession(sessionId, {
        active_runway: activeRunway,
        atis: encryptedAtis,
      });
    } catch (error) {
      if (error instanceof ExclusiveSessionNetworkFlagsError) {
        return res.status(400).json({
          error: 'Invalid session type',
          message:
            'Choose either PFATC Network or Advanced ATC Session, not both.',
        });
      }
      throw error;
    }
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    await invalidateUserSessionsCache(session.created_by);
    let decryptedAtis = {
      letter: 'A',
      text: '',
      timestamp: new Date().toISOString(),
    };
    if (session.atis) {
      try {
        const parsed =
          typeof session.atis === 'string'
            ? JSON.parse(session.atis)
            : session.atis;
        decryptedAtis = decrypt(parsed);
      } catch (err) {
        console.error('Error decrypting ATIS:', err);
        // fallback to default atis
      }
    }
    res.json({
      sessionId: session.session_id,
      accessId: session.access_id,
      activeRunway: session.active_runway,
      airportIcao: session.airport_icao,
      createdAt: session.created_at,
      createdBy: session.created_by,
      isPFATC: session.is_pfatc,
      isAdvancedATC: session.is_advanced_atc,
      atis: decryptedAtis,
    });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update session',
    });
  }
});

// POST: /api/sessions/update-name - Rename session
router.post(
  '/update-name',
  requireAuth,
  requireSessionOwnership,
  async (req, res) => {
    try {
      const { sessionId, name } = req.body;
      if (!sessionId || typeof name !== 'string' || name.length > 50) {
        return res.status(400).json({ error: 'Invalid sessionId or name' });
      }
      const sanitizedName = sanitizeAlphanumeric(name, 50);
      const updatedSession = await updateSessionName(sessionId, sanitizedName);
      if (!updatedSession) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (req.user?.userId) {
        await invalidateUserSessionsCache(req.user.userId);
        capture(req, {
          distinctId: req.user.userId,
          event: 'session_renamed',
          properties: { session_id: sessionId },
        });
      }
      res.json({ customName: updatedSession.custom_name });
    } catch (error) {
      console.error('Error updating session name:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update session name',
      });
    }
  }
);

// POST: /api/sessions/delete - Delete session (POST for compatibility)
router.post('/delete', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!isJwtPayloadClient(user)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = await getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.created_by !== user.userId) {
      return res
        .status(403)
        .json({ error: 'You can only delete your own sessions' });
    }

    await deleteSession(sessionId);
    await removeSessionFromUser(session.created_by, sessionId);
    await invalidateUserSessionsCache(session.created_by);
    capture(req, {
      distinctId: user.userId,
      event: 'session_deleted',
      properties: { session_id: sessionId, airport_icao: session.airport_icao },
    });
    res.json({ message: 'Session deleted successfully', sessionId });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete session',
    });
  }
});

// POST: /api/sessions/delete-oldest - Delete user's oldest session
router.post(
  '/delete-oldest',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!isJwtPayloadClient(user)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const userId = user.userId;
      const userSessions = await getSessionsByUser(userId);

      if (userSessions.length === 0) {
        return res.status(404).json({ error: 'No sessions found' });
      }

      const oldestSession = userSessions
        .filter((s) => s.created_at)
        .sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return aTime - bTime;
        })[0];

      if (!oldestSession) {
        return res
          .status(404)
          .json({ error: 'No sessions with valid created_at found' });
      }

      await deleteSession(oldestSession.session_id);
      await invalidateUserSessionsCache(userId);

      capture(req, {
        distinctId: userId,
        event: 'session_deleted',
        properties: {
          session_id: oldestSession.session_id,
          airport_icao: oldestSession.airport_icao,
          auto_deleted: true,
        },
      });

      res.json({
        message: 'Oldest session deleted successfully',
        sessionId: oldestSession.session_id,
        airportIcao: oldestSession.airport_icao,
        createdAt: oldestSession.created_at,
      });
    } catch (error) {
      console.error('Error deleting oldest session:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete oldest session',
      });
    }
  }
);

// GET: /api/sessions/ - Get all sessions
router.get('/', async (_req, res) => {
  try {
    const sessions = await getAllSessions();
    res.json(
      sessions.map((session) => ({
        sessionId: session.session_id,
        airportIcao: session.airport_icao,
        createdAt: session.created_at,
        createdBy: session.created_by,
        isPFATC: session.is_pfatc,
        isAdvancedATC: session.is_advanced_atc,
        activeRunway: session.active_runway,
      }))
    );
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch sessions',
    });
  }
});

export default router;
