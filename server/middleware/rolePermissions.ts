import { getUserById } from '../db/users';
import { getRoleById } from '../db/roles';
import { isAdmin } from './admin';

import { Request, Response, NextFunction } from 'express';

type PermissionKey = string;

interface Role {
    permissions: { [key: string]: boolean };
}

export function requirePermission(permission: PermissionKey) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user || typeof req.user.userId !== 'string') {
                return res.status(403).json({ error: 'Access denied - insufficient permissions' });
            }

            if (isAdmin(req.user.userId)) {
                return next();
            }

            const user = await getUserById(req.user.userId);
            if (!user || !user.roleId) {
                return res.status(403).json({ error: 'Access denied - insufficient permissions' });
            }

            const dbRole = await getRoleById(user.roleId);
            const role: Role | null = dbRole
                ? {
                    permissions: (typeof dbRole.permissions === 'object' && dbRole.permissions !== null
                        ? dbRole.permissions
                        : {}) as { [key: string]: boolean }
                }
                : null;

            if (!role || !role.permissions[permission]) {
                return res.status(403).json({ error: 'Access denied - insufficient permissions' });
            }

            next();
        } catch (error) {
            console.error('Error checking permissions:', error);
            res.status(500).json({ error: 'Failed to verify permissions' });
        }
    };
}