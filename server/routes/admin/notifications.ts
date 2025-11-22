import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { logAdminAction } from '../../db/audit.js';
import {
  getAllNotifications,
  addNotification,
  updateNotification,
  deleteNotification,
} from '../../db/notifications.js';
import { getClientIp } from '../../utils/getIpAddress.js';

const router = express.Router();

// GET: /api/admin/notifications - Get all notifications
router.get(
  '/',
  createAuditLogger('ADMIN_NOTIFICATIONS_ACCESSED'),
  async (req, res) => {
    try {
      const notifications = await getAllNotifications();
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }
);

// POST: /api/admin/notifications - Add a new notification
router.post('/', async (req, res) => {
  try {
    const { type, text, show, customColor, custom_color } = req.body;
    if (!type || !text) {
      return res.status(400).json({ error: 'Type and text are required' });
    }

    // Handle both camelCase and snake_case, clean up empty strings
    const colorValue = custom_color !== undefined ? custom_color : customColor;
    const cleanColor = colorValue?.trim() || null;

    const notification = await addNotification({
      type,
      text,
      show,
      customColor: cleanColor,
    });

    // Log the action
    if (req.user?.userId) {
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'NOTIFICATION_ADDED',
        ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
        userAgent: req.get('User-Agent'),
        details: {
          type,
          text,
          show,
          customColor: cleanColor,
          notificationId: notification.id,
        },
      });
    }

    res.json(notification);
  } catch (error) {
    console.error('Error adding notification:', error);
    res.status(500).json({ error: 'Failed to add notification' });
  }
});

// PUT: /api/admin/notifications/:id - Update a notification
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, text, show, customColor, custom_color } = req.body;
    const numericId = Number(id);

    // Handle both camelCase and snake_case, clean up empty strings
    const colorValue = custom_color !== undefined ? custom_color : customColor;
    const cleanColor = colorValue?.trim() || null; // null instead of undefined to explicitly clear

    const notification = await updateNotification(numericId, {
      type,
      text,
      show,
      customColor: cleanColor,
    });

    if (req.user?.userId) {
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'NOTIFICATION_UPDATED',
        ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
        userAgent: req.get('User-Agent'),
        details: {
          notificationId: id,
          type,
          text,
          show,
          customColor: cleanColor,
        },
      });
    }

    res.json(notification);
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// DELETE: /api/admin/notifications/:id - Delete a notification
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    if (isNaN(numericId)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }
    const deleted = await deleteNotification(numericId);

    if (req.user?.userId) {
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'NOTIFICATION_DELETED',
        ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
        userAgent: req.get('User-Agent'),
        details: { notificationId: id },
      });
    }

    res.json({ message: 'Notification deleted', deleted });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
