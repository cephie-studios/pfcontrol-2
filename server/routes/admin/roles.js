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
    getUsersWithRoles
} from '../../db/roles.js';

const router = express.Router();

// GET: /api/admin/roles - Get all roles (requires roles permission)
router.get('/', requirePermission('roles'), createAuditLogger('ADMIN_ROLES_ACCESSED'), async (req, res) => {
    try {
        const roles = await getAllRoles();
        res.json(roles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});

// GET: /api/admin/roles/users - Get users with roles (requires roles permission)
router.get('/users', requirePermission('roles'), createAuditLogger('ADMIN_ROLE_USERS_ACCESSED'), async (req, res) => {
    try {
        const users = await getUsersWithRoles();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users with roles:', error);
        res.status(500).json({ error: 'Failed to fetch users with roles' });
    }
});

// POST: /api/admin/roles - Create new role (requires roles permission)
router.post('/', requirePermission('roles'), createAuditLogger('ROLE_CREATED'), async (req, res) => {
    try {
        const { name, description, permissions } = req.body;

        if (!name || !permissions) {
            return res.status(400).json({ error: 'Name and permissions are required' });
        }

        const role = await createRole({ name, description, permissions });
        res.status(201).json(role);
    } catch (error) {
        console.error('Error creating role:', error);
        if (error.code === '23505') { // Unique constraint violation
            res.status(400).json({ error: 'Role name already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create role' });
        }
    }
});

// PUT: /api/admin/roles/:id - Update role (requires roles permission)
router.put('/:id', requirePermission('roles'), createAuditLogger('ROLE_UPDATED'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, permissions } = req.body;

        const existingRole = await getRoleById(parseInt(id));
        if (!existingRole) {
            return res.status(404).json({ error: 'Role not found' });
        }

        const updatedRole = await updateRole(parseInt(id), { name, description, permissions });
        res.json(updatedRole);
    } catch (error) {
        console.error('Error updating role:', error);
        if (error.code === '23505') {
            res.status(400).json({ error: 'Role name already exists' });
        } else {
            res.status(500).json({ error: 'Failed to update role' });
        }
    }
});

// DELETE: /api/admin/roles/:id - Delete role (requires roles permission)
router.delete('/:id', requirePermission('roles'), createAuditLogger('ROLE_DELETED'), async (req, res) => {
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
});

// POST: /api/admin/roles/assign - Assign role to user (requires roles permission)
router.post('/assign', requirePermission('roles'), createAuditLogger('ROLE_ASSIGNED'), async (req, res) => {
    try {
        const { userId, roleId } = req.body;

        if (!userId || !roleId) {
            return res.status(400).json({ error: 'User ID and Role ID are required' });
        }

        const result = await assignRoleToUser(userId, roleId);
        res.json(result);
    } catch (error) {
        console.error('Error assigning role:', error);
        res.status(500).json({ error: 'Failed to assign role' });
    }
});

// POST: /api/admin/roles/remove - Remove role from user (requires roles permission)
router.post('/remove', requirePermission('roles'), createAuditLogger('ROLE_REMOVED'), async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const result = await removeRoleFromUser(userId);
        res.json(result);
    } catch (error) {
        console.error('Error removing role:', error);
        res.status(500).json({ error: 'Failed to remove role' });
    }
});

export default router;