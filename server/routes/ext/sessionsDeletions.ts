import express from 'express';
import type { Request, Response } from 'express';
import { deleteSession } from '../../db/sessions.js';
import { removeSessionFromUser } from '../../db/users.js';
import { deleteFlight, getFlightById } from '../../db/flights.js';
import { validateFlightId } from '../../utils/validation.js';
import { broadcastFlightEvent } from '../../websockets/flightsWebsocket.js';
import { redisConnection } from '../../db/connection.js';
import { keys } from '../../realtime/keys.js';
import {
  sessionDeletionLimiter,
  flightDeletionLimiter,
} from '../../middleware/rateLimiting.js';
import {
  loadOwnedSessionOr404,
  routeParamString,
  extCtx,
  usernameFor,
} from './sessionsFlights.js';
import { sendServerError } from '../../utils/apiError.js';
import { logFlightAction } from '../../db/flightLogs.js';

const router = express.Router();

async function invalidateUserSessionsCache(userId: string): Promise<void> {
  try {
    await redisConnection.del(keys.userSessions(userId));
  } catch {
    // ignore
  }
}

function ownedByThisKey(
  session: { developer_api_key_id?: string | null },
  keyId: string
): boolean {
  return String(session.developer_api_key_id ?? '') === keyId;
}

router.delete(
  '/:sessionId',
  sessionDeletionLimiter,
  async (req: Request, res: Response) => {
    try {
      const ext = extCtx(req);
      const loaded = await loadOwnedSessionOr404(
        req.params.sessionId,
        ext.userId
      );
      if (!loaded.ok) return res.status(loaded.status).json(loaded.body);

      const session = loaded.session;
      if (!ownedByThisKey(session, ext.keyId)) {
        return res.status(403).json({
          error:
            'Session deletion via the developer API is only allowed for sessions created with this API key.',
        });
      }

      await deleteSession(session.session_id);
      await removeSessionFromUser(session.created_by, session.session_id);
      await invalidateUserSessionsCache(session.created_by);

      res.json({
        message: 'Session deleted successfully',
        sessionId: session.session_id,
      });
    } catch (e) {
      console.error('[ext/sessions] delete:', e);
      sendServerError(res, 'Failed to delete session', e);
    }
  }
);

router.delete(
  '/:sessionId/flights/:flightId',
  flightDeletionLimiter,
  async (req: Request, res: Response) => {
    try {
      const ext = extCtx(req);
      const loaded = await loadOwnedSessionOr404(
        req.params.sessionId,
        ext.userId
      );
      if (!loaded.ok) return res.status(loaded.status).json(loaded.body);

      const session = loaded.session;
      if (!ownedByThisKey(session, ext.keyId)) {
        return res.status(403).json({
          error:
            'Flight deletion via the developer API is only allowed for sessions created with this same API key.',
        });
      }

      let fid: string;
      try {
        fid = validateFlightId(routeParamString(req.params.flightId));
      } catch {
        return res.status(404).json({ error: 'Not found' });
      }

      const flight = await getFlightById(session.session_id, fid);
      if (!flight) return res.status(404).json({ error: 'Not found' });

      await deleteFlight(session.session_id, fid);
      broadcastFlightEvent(session.session_id, 'flightDeleted', {
        flightId: fid,
      });

      setImmediate(() => {
        void (async () => {
          const { user_id: _uid, ip_address: _ip, acars_token: _at, ...oldSanitized } =
            flight;
          void logFlightAction({
            userId: ext.userId,
            username: await usernameFor(ext.userId),
            sessionId: session.session_id,
            action: 'delete',
            flightId: fid,
            oldData: oldSanitized,
          });
        })();
      });

      res.json({ message: 'Flight deleted successfully', flightId: fid });
    } catch (e) {
      console.error('[ext/sessions] delete flight:', e);
      sendServerError(res, 'Failed to delete flight', e);
    }
  }
);

export default router;
