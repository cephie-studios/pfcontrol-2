import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { logAdminAction } from '../../db/audit.js';
import {
  getAllTesters,
  addTester,
  removeTester,
  updateTesterSetting,
} from '../../db/testers.js';
import { getUserById } from '../../db/users.js';
import { getClientIp } from '../../utils/getIpAddress.js';
import {
  getAllRoles,
  createRole,
  assignRoleToUser,
  removeRoleFromUser,
} from '../../db/roles.js';

const router = express.Router();

async function ensureTesterRole() {
  try {
    const roles = await getAllRoles();
    let testerRole = roles.find((r) => r.name === 'Tester');

    if (!testerRole) {
      const createdRole = await createRole({
        name: 'Tester',
        description: 'Beta tester with early access to new features',
        permissions: {},
        color: '#EAB308',
        icon: 'FlaskConical',
        priority: 5,
      });
      if (!createdRole) {
        throw new Error('Failed to create Tester role');
      }
      if (
        'user_count' in createdRole &&
        typeof createdRole.user_count === 'number'
      ) {
        testerRole = {
          ...createdRole,
          user_count: Number(createdRole.user_count),
        };
      } else {
        testerRole = { ...createdRole, user_count: 0 };
      }
    }

    return testerRole;
  } catch (error) {
    console.error('Error ensuring Tester role exists:', error);
    throw error;
  }
}

// GET: /api/admin/testers - Get all testers with pagination and search
router.get(
  '/',
  createAuditLogger('ADMIN_TESTERS_ACCESSED'),
  async (req, res) => {
    try {
      const page =
        typeof req.query.page === 'string' ? parseInt(req.query.page) : 1;
      const limit =
        typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 50;
      const search =
        typeof req.query.search === 'string' ? req.query.search : '';

      const result = await getAllTesters(page, limit, search);
      res.json(result);
    } catch (error) {
      console.error('Error fetching testers:', error);
      res.status(500).json({ error: 'Failed to fetch testers' });
    }
  }
);

// POST: /api/admin/testers - Add a new tester
router.post('/', async (req, res) => {
  try {
    const { userId, notes = '' } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!req.user || typeof req.user.userId !== 'string') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const tester = await addTester(
      userId,
      user.username,
      req.user.userId,
      req.user.username || 'Admin',
      notes
    );

    try {
      const testerRole = await ensureTesterRole();
      if (testerRole) {
        await assignRoleToUser(userId, testerRole.id);
      }
    } catch (roleError) {
      console.error('Failed to assign Tester role:', roleError);
    }

    if (req.user?.userId) {
      try {
        let ip = getClientIp(req);
        if (Array.isArray(ip)) ip = ip[0] || '';
        await logAdminAction({
          adminId: req.user.userId,
          adminUsername: req.user.username || 'Unknown',
          actionType: 'TESTER_ADDED',
          targetUserId: userId,
          targetUsername: user.username,
          ipAddress: ip,
          userAgent: req.get('User-Agent'),
          details: {
            method: req.method,
            url: req.originalUrl,
            notes: notes,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (auditError) {
        console.error('Failed to log tester added action:', auditError);
      }
    }

    res.json(tester);
  } catch (error) {
    console.error('Error adding tester:', error);
    res.status(500).json({ error: 'Failed to add tester' });
  }
});

// DELETE: /api/admin/testers/:userId - Remove a tester
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await getUserById(userId);
    const removedTester = await removeTester(userId);

    if (!removedTester) {
      return res.status(404).json({ error: 'Tester not found' });
    }

    try {
      const testerRole = await ensureTesterRole();
      if (testerRole) {
        await removeRoleFromUser(userId, testerRole.id);
      }
    } catch (roleError) {
      console.error('Failed to remove Tester role:', roleError);
    }

    if (req.user?.userId) {
      try {
        let ip = getClientIp(req);
        if (Array.isArray(ip)) ip = ip[0] || '';
        await logAdminAction({
          adminId: req.user.userId,
          adminUsername: req.user.username || 'Unknown',
          actionType: 'TESTER_REMOVED',
          targetUserId: userId,
          targetUsername: user?.username || removedTester.username,
          ipAddress: ip,
          userAgent: req.get('User-Agent'),
          details: {
            method: req.method,
            url: req.originalUrl,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (auditError) {
        console.error('Failed to log tester removed action:', auditError);
      }
    }

    res.json({ message: 'Tester removed successfully', tester: removedTester });
  } catch (error) {
    console.error('Error removing tester:', error);
    res.status(500).json({ error: 'Failed to remove tester' });
  }
});

// PUT: /api/admin/testers/settings - Update tester gate settings
router.put('/settings', async (req, res) => {
  try {
    const { tester_gate_enabled } = req.body;

    if (typeof tester_gate_enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid setting value' });
    }

    const updated = await updateTesterSetting(
      'tester_gate_enabled',
      tester_gate_enabled
    );

    if (req.user?.userId) {
      try {
        let ip = getClientIp(req);
        if (Array.isArray(ip)) ip = ip[0] || '';
        await logAdminAction({
          adminId: req.user.userId,
          adminUsername: req.user.username || 'Unknown',
          actionType: 'TESTER_SETTINGS_UPDATED',
          ipAddress: ip,
          userAgent: req.get('User-Agent'),
          details: {
            method: req.method,
            url: req.originalUrl,
            settingChanged: 'tester_gate_enabled',
            newValue: tester_gate_enabled,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (auditError) {
        console.error('Failed to log tester settings update:', auditError);
      }
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating tester settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
