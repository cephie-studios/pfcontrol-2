import express from 'express';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { logAdminAction } from '../../db/audit.js';
import { getClientIp } from '../../utils/getIpAddress.js';
import {
  getUsersWithProfileContentForAdmin,
  adminClearUserBio,
} from '../../db/users.js';
import { createUserNotification } from '../../db/userNotifications.js';

const router = express.Router();

// GET: /api/admin/profile-content
router.get(
  '/',
  requirePermission('admin'),
  createAuditLogger('ADMIN_PROFILE_CONTENT_VIEWED'),
  async (_req, res) => {
    try {
      const users = await getUsersWithProfileContentForAdmin();
      res.json({ users });
    } catch (error) {
      console.error('Error fetching profile content for admin:', error);
      res.status(500).json({ error: 'Failed to fetch profile content' });
    }
  }
);

// POST: /api/admin/profile-content/:userId/clear-bio
router.post(
  '/:userId/clear-bio',
  requirePermission('admin'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      await adminClearUserBio(userId);

      void createUserNotification({
        userId,
        type: 'moderation',
        title: 'Your bio was removed',
        message:
          'Your profile bio was removed by a moderator for violating platform guidelines.',
        issuedByAdminId: req.user?.userId,
        issuedByAdminUsername: req.user?.username,
      });

      if (req.user?.userId) {
        const ip = getClientIp(req);
        await logAdminAction({
          adminId: req.user.userId,
          adminUsername: req.user.username || 'Unknown',
          actionType: 'PROFILE_BIO_CLEARED',
          targetUserId: userId,
          ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
          userAgent: req.get('User-Agent'),
        });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('Error clearing bio:', error);
      res.status(500).json({ error: 'Failed to clear bio' });
    }
  }
);

export default router;
