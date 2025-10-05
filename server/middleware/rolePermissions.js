import { getUserById } from '../db/users.js';
import { getRoleById } from '../db/roles.js';
import { isAdmin } from './isAdmin.js';

export function requirePermission(permission) {
    return async (req, res, next) => {
        try {
            if (isAdmin(req.user?.userId)) {
                return next();
            }

            const user = await getUserById(req.user.userId);
            if (!user || !user.roleId) {
                return res.status(403).json({ error: 'Access denied - insufficient permissions' });
            }

            const role = await getRoleById(user.roleId);
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