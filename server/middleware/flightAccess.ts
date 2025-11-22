import { Request, Response, NextFunction } from 'express';
import { mainDb } from '../db/connection.js';
import { getUserRoles } from '../db/roles.js';

export async function requireFlightAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId;

    if (!sessionId || !userId) {
      return res.status(400).json({
        error: 'Session ID and authentication are required',
      });
    }

    // Get session info
    const session = await mainDb
      .selectFrom('sessions')
      .select(['session_id', 'access_id', 'created_by', 'is_pfatc'])
      .where('session_id', '=', sessionId)
      .executeTakeFirst();

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
      });
    }

    const userRoles = await getUserRoles(userId);
    const hasEventControllerRole = userRoles.some(
      (role) =>
        role.name === 'event_controller' || role.name === 'Event Controller'
    );

    if (hasEventControllerRole) {
      if (!session.is_pfatc) {
        return res.status(403).json({
          error: 'Event controllers can only modify PFATC sessions',
        });
      }
      return next();
    }

    const accessId = req.query.accessId || req.body.accessId;
    if (accessId && accessId === session.access_id) {
      return next();
    }

    if (userId === session.created_by) {
      return next();
    }

    return res.status(403).json({
      error: 'Not authorized to modify flights in this session',
    });
  } catch (error) {
    console.error('Flight access validation error:', error);
    return res.status(500).json({
      error: 'Failed to verify flight access permissions',
    });
  }
}

export async function isEventController(userId: string): Promise<boolean> {
  try {
    const userRoles = await getUserRoles(userId);
    return userRoles.some(
      (role) =>
        role.name === 'event_controller' || role.name === 'Event Controller'
    );
  } catch (error) {
    console.error('Error checking event controller status:', error);
    return false;
  }
}

export async function canModifySession(
  userId: string,
  sessionId: string,
  accessId?: string
): Promise<boolean> {
  try {
    // Get session info
    const session = await mainDb
      .selectFrom('sessions')
      .select(['session_id', 'access_id', 'created_by', 'is_pfatc'])
      .where('session_id', '=', sessionId)
      .executeTakeFirst();

    if (!session) {
      return false;
    }

    // Check if event controller
    const hasEventControllerRole = await isEventController(userId);
    if (hasEventControllerRole && session.is_pfatc) {
      return true;
    }

    // Check accessId
    if (accessId && accessId === session.access_id) {
      return true;
    }

    // Check ownership
    if (userId === session.created_by) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking session modification permissions:', error);
    return false;
  }
}
