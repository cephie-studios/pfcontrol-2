import express from 'express';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { logAdminAction } from '../../db/audit.js';
import { getClientIp } from '../../utils/getIpAddress.js';
import {
  getAllFeaturedFlightsForAdmin,
  adminUnfeatureFlight,
  deleteSnapImage,
} from '../../db/flights.js';
import { createUserNotification } from '../../db/userNotifications.js';

const router = express.Router();

// GET: /api/admin/featured-flights - Every featured flight platform-wide,
// joined with its owner, for moderation review.
router.get(
  '/',
  requirePermission('admin'),
  createAuditLogger('ADMIN_FEATURED_FLIGHTS_VIEWED'),
  async (_req, res) => {
    try {
      const flights = await getAllFeaturedFlightsForAdmin();
      res.json({ flights });
    } catch (error) {
      console.error('Error fetching featured flights for admin:', error);
      res.status(500).json({ error: 'Failed to fetch featured flights' });
    }
  }
);

// POST: /api/admin/featured-flights/:userId/:flightId/unfeature
router.post(
  '/:userId/:flightId/unfeature',
  requirePermission('admin'),
  async (req, res) => {
    try {
      const { userId, flightId } = req.params;
      const result = await adminUnfeatureFlight(userId, flightId);
      if (!result.ok) {
        return res.status(404).json({ error: 'Flight not found' });
      }

      void createUserNotification({
        userId,
        type: 'moderation',
        title: 'A featured flight was removed',
        message:
          'One of your featured flights was removed from your public profile by a moderator.',
      });

      if (req.user?.userId) {
        const ip = getClientIp(req);
        await logAdminAction({
          adminId: req.user.userId,
          adminUsername: req.user.username || 'Unknown',
          actionType: 'FEATURED_FLIGHT_UNFEATURED',
          targetUserId: userId,
          ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
          userAgent: req.get('User-Agent'),
          details: { flightId },
        });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('Error unfeaturing flight:', error);
      res.status(500).json({ error: 'Failed to unfeature flight' });
    }
  }
);

// DELETE: /api/admin/featured-flights/:userId/:flightId/images/:cephieId
router.delete(
  '/:userId/:flightId/images/:cephieId',
  requirePermission('admin'),
  async (req, res) => {
    try {
      const { userId, flightId, cephieId } = req.params;
      const result = await deleteSnapImage(userId, flightId, cephieId);
      if (!result.ok) {
        return res.status(404).json({ error: 'Image not found' });
      }

      void createUserNotification({
        userId,
        type: 'moderation',
        title: 'An image was removed',
        message:
          'An image on one of your featured flights was removed by a moderator for violating platform guidelines.',
      });

      if (req.user?.userId) {
        const ip = getClientIp(req);
        await logAdminAction({
          adminId: req.user.userId,
          adminUsername: req.user.username || 'Unknown',
          actionType: 'FEATURED_FLIGHT_IMAGE_DELETED',
          targetUserId: userId,
          ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
          userAgent: req.get('User-Agent'),
          details: { flightId, cephieId },
        });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('Error deleting flight image:', error);
      res.status(500).json({ error: 'Failed to delete image' });
    }
  }
);

export default router;
