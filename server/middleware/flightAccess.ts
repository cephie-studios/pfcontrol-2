import { Request, Response, NextFunction } from 'express';
import { mainDb } from '../db/connection.js';
import { getUserRoles } from '../db/roles.js';

function hasPermission(
  roles: Awaited<ReturnType<typeof getUserRoles>>,
  permKey: string
): boolean {
  return roles.some((role) => {
    let perms = role.permissions;
    if (typeof perms === 'string') {
      try {
        perms = JSON.parse(perms);
      } catch {
        return false;
      }
    }
    return (
      perms &&
      typeof perms === 'object' &&
      (perms as Record<string, boolean>)[permKey] === true
    );
  });
}

/** Check if user can edit PFATC session flights (pfatc_sector permission) */
export async function isPFATCSectorController(
  userId: string
): Promise<boolean> {
  try {
    const userRoles = await getUserRoles(userId);
    return hasPermission(userRoles, 'pfatc_sector');
  } catch {
    return false;
  }
}

/** AATC disabled — isAATCSectorController always returns false */
export async function isAATCSectorController(
  _userId: string
): Promise<boolean> {
  return false; // AATC disabled — was: hasPermission(userRoles, 'aatc_sector')
}

/** Legacy alias — kept for websocket compatibility */
export async function isEventController(userId: string): Promise<boolean> {
  try {
    const userRoles = await getUserRoles(userId);
    return hasPermission(userRoles, 'pfatc_sector'); // AATC disabled — was: || hasPermission(userRoles, 'aatc_sector')
  } catch {
    return false;
  }
}

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

    const session = await mainDb
      .selectFrom('sessions')
      .select([
        'session_id',
        'access_id',
        'created_by',
        'is_pfatc',
        'is_advanced_atc',
      ])
      .where('session_id', '=', sessionId)
      .executeTakeFirst();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const userRoles = await getUserRoles(userId);

    // PFATC Sector Controller can edit flights in PFATC sessions
    if (hasPermission(userRoles, 'pfatc_sector') && session.is_pfatc) {
      return next();
    }

    // AATC disabled — AATC Sector Controller check removed
    // if (hasPermission(userRoles, 'aatc_sector') && session.is_advanced_atc) {
    //   return next();
    // }

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

export async function canModifySession(
  userId: string,
  sessionId: string,
  accessId?: string
): Promise<boolean> {
  try {
    const session = await mainDb
      .selectFrom('sessions')
      .select([
        'session_id',
        'access_id',
        'created_by',
        'is_pfatc',
        'is_advanced_atc',
      ])
      .where('session_id', '=', sessionId)
      .executeTakeFirst();

    if (!session) return false;

    const userRoles = await getUserRoles(userId);

    if (hasPermission(userRoles, 'pfatc_sector') && session.is_pfatc)
      return true;
    // AATC disabled — if (hasPermission(userRoles, 'aatc_sector') && session.is_advanced_atc) return true;

    if (accessId && accessId === session.access_id) return true;
    if (userId === session.created_by) return true;

    return false;
  } catch (error) {
    console.error('Error checking session modification permissions:', error);
    return false;
  }
}
