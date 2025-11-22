import { mainDb } from '../db/connection.js';
import { Request, Response, NextFunction } from 'express';

export async function validateSessionAccess(
  sessionId: string,
  accessId: string
) {
  if (!sessionId || !accessId) {
    return false;
  }

  try {
    const result = await mainDb
      .selectFrom('sessions')
      .select(['session_id', 'access_id'])
      .where('session_id', '=', sessionId)
      .where('access_id', '=', accessId)
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Session access validation error:', error);
    return false;
  }
}

export async function validateSessionOwnership(
  sessionId: string,
  userId: string
) {
  if (!sessionId || !userId) return false;

  try {
    const result = await mainDb
      .selectFrom('sessions')
      .select('session_id')
      .where('session_id', '=', sessionId)
      .where('created_by', '=', userId)
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Session ownership validation error:', error);
    return false;
  }
}

export function requireSessionAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { sessionId } = req.params;
  const accessId =
    (req.query && req.query.accessId) || (req.body && req.body.accessId);

  if (!sessionId || !accessId) {
    return res.status(400).json({
      error: 'Session ID and access ID are required',
    });
  }

  validateSessionAccess(sessionId, accessId)
    .then((isValid) => {
      if (!isValid) {
        return res.status(403).json({
          error: 'Invalid session access',
        });
      }
      next();
    })
    .catch((error) => {
      console.error('Session access validation error:', error);
      res.status(500).json({
        error: 'Session validation failed',
      });
    });
}

export function requireSessionOwnership(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sessionId = req.params.sessionId || req.body.sessionId;
  const userId = req.user?.userId;

  if (!sessionId || !userId) {
    return res.status(400).json({
      error: 'Session ID and authentication are required',
    });
  }

  validateSessionOwnership(sessionId, userId)
    .then((isOwner) => {
      if (!isOwner) {
        return res.status(403).json({
          error: 'Only session owner can perform this action',
        });
      }
      next();
    })
    .catch((error) => {
      console.error('Session ownership validation error:', error);
      res.status(500).json({
        error: 'Session ownership validation failed',
      });
    });
}
