import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignRoleToUser,
  removeRoleFromUser,
  getUsersWithRoles,
  updateRolePriorities,
} from '../../db/roles.js';
import { mainDb } from '../../db/connection.js';
import { getClientIp } from '../../utils/getIpAddress.js';
import { logAdminAction } from '../../db/audit.js';

const router = express.Router();

// GET: /api/admin/roles - Get all roles (requires users permission)
router.get(
  '/',
  requirePermission('users'),
  createAuditLogger('ADMIN_ROLES_ACCESSED'),
  async (req, res) => {
    try {
      const roles = await getAllRoles();
      res.json(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  }
);

// GET: /api/admin/roles/users - Get users with roles (requires users permission)
router.get(
  '/users',
  requirePermission('users'),
  createAuditLogger('ADMIN_ROLE_USERS_ACCESSED'),
  async (req, res) => {
    try {
      const users = await getUsersWithRoles();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users with roles:', error);
      res.status(500).json({ error: 'Failed to fetch users with roles' });
    }
  }
);

// POST: /api/admin/roles - Create new role (requires roles permission)
router.post(
  '/',
  requirePermission('roles'),
  createAuditLogger('ROLE_CREATED'),
  async (req, res) => {
    try {
      const { name, description, permissions, color, icon, priority } =
        req.body;

      if (!name || !permissions) {
        return res
          .status(400)
          .json({ error: 'Name and permissions are required' });
      }

      const role = await createRole({
        name,
        description,
        permissions,
        color,
        icon,
        priority,
      });
      res.status(201).json(role);
    } catch (error) {
      console.error('Error creating role:', error);
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
      ) {
        res.status(400).json({ error: 'Role name already exists' });
      } else {
        res.status(500).json({ error: 'Failed to create role' });
      }
    }
  }
);

// PUT: /api/admin/roles/priorities - Update role priorities (requires roles permission)
router.put(
  '/priorities',
  requirePermission('roles'),
  createAuditLogger('ROLE_PRIORITIES_UPDATED'),
  async (req, res) => {
    try {
      const { rolePriorities } = req.body;

      if (!rolePriorities || !Array.isArray(rolePriorities)) {
        return res
          .status(400)
          .json({ error: 'Role priorities array is required' });
      }

      // Validate each priority object has valid id and priority
      const invalidEntries = rolePriorities.filter(
        (item) =>
          !item.id ||
          isNaN(parseInt(item.id)) ||
          item.priority === undefined ||
          isNaN(parseInt(item.priority))
      );

      if (invalidEntries.length > 0) {
        return res.status(400).json({ error: 'Invalid role priority data' });
      }

      await updateRolePriorities(rolePriorities);
      res.json({
        success: true,
        message: 'Role priorities updated successfully',
      });
    } catch (error) {
      console.error('Error updating role priorities:', error);
      res.status(500).json({ error: 'Failed to update role priorities' });
    }
  }
);

// PUT: /api/admin/roles/:id - Update role (requires roles permission)
router.put(
  '/:id',
  requirePermission('roles'),
  createAuditLogger('ROLE_UPDATED'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, permissions, color, icon, priority } =
        req.body;

      const roleId = parseInt(id);
      if (isNaN(roleId)) {
        return res.status(400).json({ error: 'Invalid role ID' });
      }

      const existingRole = await getRoleById(roleId);
      if (!existingRole) {
        return res.status(404).json({ error: 'Role not found' });
      }

      const updatedRole = await updateRole(roleId, {
        name,
        description,
        permissions,
        color,
        icon,
        priority,
      });
      res.json(updatedRole);
    } catch (error) {
      console.error('Error updating role:', error);
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        res.status(400).json({ error: 'Role name already exists' });
      } else {
        res.status(500).json({ error: 'Failed to update role' });
      }
    }
  }
);

// DELETE: /api/admin/roles/:id - Delete role (requires roles permission)
router.delete(
  '/:id',
  requirePermission('roles'),
  createAuditLogger('ROLE_DELETED'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const existingRole = await getRoleById(parseInt(id));
      if (!existingRole) {
        return res.status(404).json({ error: 'Role not found' });
      }

      await deleteRole(parseInt(id));
      res.json({ message: 'Role deleted successfully' });
    } catch (error) {
      console.error('Error deleting role:', error);
      res.status(500).json({ error: 'Failed to delete role' });
    }
  }
);

// POST: /api/admin/roles/assign - Assign role to user (requires roles permission)
router.post('/assign', requirePermission('roles'), async (req, res) => {
  try {
    const { userId, roleId } = req.body;

    if (!userId || !roleId) {
      return res
        .status(400)
        .json({ error: 'User ID and Role ID are required' });
    }

    const result = await assignRoleToUser(userId, roleId);

    if (req.user?.userId) {
      try {
        const targetUser = await mainDb
          .selectFrom('users')
          .select(['username'])
          .where('id', '=', userId)
          .executeTakeFirst();

        let ip = getClientIp(req);
        if (Array.isArray(ip)) ip = ip[0] || '';
        await logAdminAction({
          adminId: req.user.userId,
          adminUsername: req.user.username || 'Unknown',
          actionType: 'ROLE_ASSIGNED',
          targetUserId: userId,
          targetUsername: targetUser?.username || 'Unknown',
          ipAddress: ip,
          userAgent: req.get('User-Agent'),
          details: {
            method: req.method,
            url: req.originalUrl,
            roleId,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (auditError) {
        console.error('Failed to log role assignment:', auditError);
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

// POST: /api/admin/roles/remove - Remove role from user (requires roles permission)
router.post(
  '/remove',
  requirePermission('roles'),
  createAuditLogger('ROLE_REMOVED'),
  async (req, res) => {
    try {
      const { userId, roleId } = req.body;

      if (!userId || !roleId) {
        return res
          .status(400)
          .json({ error: 'User ID and Role ID are required' });
      }

      const result = await removeRoleFromUser(userId, roleId);
      res.json(result);
    } catch (error) {
      console.error('Error removing role:', error);
      res.status(500).json({ error: 'Failed to remove role' });
    }
  }
);

export default router;
