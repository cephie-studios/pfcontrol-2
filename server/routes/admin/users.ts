import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { getAllUsers, syncUserSessionCounts } from '../../db/admin.js';
import { getUserById, setUserVpnFlag } from '../../db/users.js';
import { logAdminAction } from '../../db/audit.js';
import { isAdmin } from '../../middleware/admin.js';
import { getClientIp } from '../../utils/getIpAddress.js';

const router = express.Router();

router.use(requirePermission('users'));

// GET: /api/admin/users - Get all users with pagination, search, and filters
router.get('/', createAuditLogger('ADMIN_USERS_ACCESSED'), async (req, res) => {
  try {
    const page =
      typeof req.query.page === 'string' ? parseInt(req.query.page) : 1;
    const limit =
      typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 50;
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const filterAdmin =
      typeof req.query.filterAdmin === 'string' ? req.query.filterAdmin : 'all';

    const result = await getAllUsers(page, limit, search, filterAdmin);
    res.json(result);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST: /api/admin/users/:userId/reveal-ip - Reveal user's IP address
router.post('/:userId/reveal-ip', async (req, res) => {
  try {
    if (!req.user?.userId || !isAdmin(req.user.userId)) {
      return res
        .status(403)
        .json({ error: 'Access denied - insufficient permissions' });
    }

    const { userId } = req.params;
    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user?.userId) {
      let ip = getClientIp(req);
      if (Array.isArray(ip)) ip = ip[0] || '';
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'IP_REVEALED',
        targetUserId: userId,
        targetUsername: user.username,
        ipAddress: ip,
        userAgent: req.get('User-Agent'),
        details: {
          revealedIP: user.ip_address,
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.json({
      userId: user.id,
      username: user.username,
      ip_address: user.ip_address,
    });
  } catch (error) {
    console.error('Error revealing IP address:', error);
    res.status(500).json({ error: 'Failed to reveal IP address' });
  }
});

// POST: /api/admin/users/sync-session-counts - Sync session counts for all users
router.post(
  '/sync-session-counts',
  createAuditLogger('ADMIN_SYNC_SESSION_COUNTS'),
  async (req, res) => {
    try {
      const result = await syncUserSessionCounts();
      res.json(result);
    } catch (error) {
      console.error('Error syncing session counts:', error);
      res.status(500).json({ error: 'Failed to sync session counts' });
    }
  }
);

// POST: /api/admin/users/:userId/set-vpn — set is_vpn flag and invalidate user cache
router.post('/:userId/set-vpn', async (req, res) => {
  try {
    if (!req.user?.userId || !isAdmin(req.user.userId)) {
      return res.status(403).json({ error: 'Access denied - insufficient permissions' });
    }

    const { userId } = req.params;
    const { isVpn } = req.body;
    if (typeof isVpn !== 'boolean') {
      return res.status(400).json({ error: 'isVpn must be a boolean' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await setUserVpnFlag(userId, isVpn);

    try {
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'VPN_FLAG_SET',
        targetUserId: userId,
        targetUsername: user.username,
        ipAddress: ip,
        userAgent: req.get('User-Agent'),
        details: { isVpn },
      });
    } catch (auditErr) {
      console.error('[audit] Failed to log VPN_FLAG_SET for user', userId, auditErr);
    }

    res.json({ success: true, userId, isVpn });
  } catch (error) {
    console.error('Error setting VPN flag:', error);
    res.status(500).json({ error: 'Failed to set VPN flag' });
  }
});

export default router;
