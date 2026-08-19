import express from 'express';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { logAdminAction } from '../../db/audit.js';
import { getClientIp } from '../../utils/getIpAddress.js';
import { getUserByUsername, getUserById } from '../../db/users.js';
import {
  createUserNotification,
  getAllUserNotificationsForAdmin,
} from '../../db/userNotifications.js';

const router = express.Router();

// GET: /api/admin/user-alerts - Every alert ever sent, newest first, paginated
router.get('/', requirePermission('admin'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(
      1,
      Math.min(100, parseInt(req.query.limit as string, 10) || 50)
    );
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const result = await getAllUserNotificationsForAdmin(page, limit, search);
    res.json(result);
  } catch (error) {
    console.error('Error fetching user alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// POST: /api/admin/user-alerts - Send a new alert to a user, by username or userId
router.post('/', requirePermission('admin'), async (req, res) => {
  try {
    const { username, userId, type, title, message } = req.body ?? {};
    const hasUsername = typeof username === 'string' && username.trim();
    const hasUserId = typeof userId === 'string' && userId.trim();
    if (
      (!hasUsername && !hasUserId) ||
      typeof title !== 'string' ||
      !title.trim() ||
      typeof message !== 'string' ||
      !message.trim()
    ) {
      return res.status(400).json({
        error:
          'Either username or userId is required, along with title and message',
      });
    }

    const user = hasUserId
      ? await getUserById(userId.trim())
      : await getUserByUsername(username.trim());
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const notification = await createUserNotification({
      userId: user.id,
      type: typeof type === 'string' && type.trim() ? type.trim() : 'alert',
      title: title.trim(),
      message: message.trim(),
      issuedByAdminId: req.user?.userId,
      issuedByAdminUsername: req.user?.username,
    });

    if (req.user?.userId) {
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'USER_ALERT_SENT',
        targetUserId: user.id,
        targetUsername: user.username,
        ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
        userAgent: req.get('User-Agent'),
        details: { title: title.trim() },
      });
    }

    res.json({ notification });
  } catch (error) {
    console.error('Error sending user alert:', error);
    res.status(500).json({ error: 'Failed to send alert' });
  }
});

export default router;
