import { Request, Response, NextFunction } from 'express';
import { getUserById } from '../db/users.js';
import { isAdmin } from './admin.js';

type PermissionKey = string;

export function requirePermission(permission: PermissionKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || typeof req.user.userId !== 'string') {
        return res
          .status(403)
          .json({ error: 'Access denied - insufficient permissions' });
      }

      if (isAdmin(req.user.userId)) {
        return next();
      }

      const user = await getUserById(req.user.userId);
      if (!user) {
        return res
          .status(403)
          .json({ error: 'Access denied - user not found' });
      }

      const { getUserRoles } = await import('../db/roles.js');
      const userRoles = await getUserRoles(user.id);

      const mergedPermissions: Record<string, boolean> = {};
      for (const role of userRoles) {
        let perms = role.permissions;
        if (typeof perms === 'string') {
          try {
            perms = JSON.parse(perms);
          } catch {
            perms = {};
          }
        }
        if (perms && typeof perms === 'object') {
          Object.assign(mergedPermissions, perms as Record<string, boolean>);
        }
      }

      if (!mergedPermissions[permission]) {
        return res
          .status(403)
          .json({ error: 'Access denied - insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('Error checking permissions:', error);
      res.status(500).json({ error: 'Failed to verify permissions' });
    }
  };
}
