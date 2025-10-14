import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { logAdminAction } from '../../db/audit.js';
import {
    getAllNotifications,
    getActiveNotifications,
    addNotification,
    updateNotification,
    deleteNotification
} from '../../db/notifications.js';
import { getClientIp } from '../../tools/getIpAddress.js';

const router = express.Router();

// GET: /api/admin/notifications - Get all notifications
router.get('/', createAuditLogger('ADMIN_NOTIFICATIONS_ACCESSED'), async (req, res) => {
    try {
        const notifications = await getAllNotifications();
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// POST: /api/admin/notifications - Add a new notification
router.post('/', async (req, res) => {
    try {
        const { type, text, show, customColor } = req.body;
        if (!type || !text) {
            return res.status(400).json({ error: 'Type and text are required' });
        }

        const notification = await addNotification({ type, text, show, customColor });

        // Log the action
        if (req.user?.userId) {
            await logAdminAction({
                adminId: req.user.userId,
                adminUsername: req.user.username || 'Unknown',
                actionType: 'NOTIFICATION_ADDED',
                ipAddress: getClientIp(req),
                userAgent: req.get('User-Agent'),
                details: { type, text, show, customColor, notificationId: notification.id }
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
        const { type, text, show, customColor } = req.body;

        const notification = await updateNotification(id, { type, text, show, customColor });

        if (req.user?.userId) {
            await logAdminAction({
                adminId: req.user.userId,
                adminUsername: req.user.username || 'Unknown',
                actionType: 'NOTIFICATION_UPDATED',
                ipAddress: getClientIp(req),
                userAgent: req.get('User-Agent'),
                details: { notificationId: id, type, text, show, customColor }
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
        const deleted = await deleteNotification(id);

        if (req.user?.userId) {
            await logAdminAction({
                adminId: req.user.userId,
                adminUsername: req.user.username || 'Unknown',
                actionType: 'NOTIFICATION_DELETED',
                ipAddress: getClientIp(req),
                userAgent: req.get('User-Agent'),
                details: { notificationId: id }
            });
        }

        res.json({ message: 'Notification deleted', deleted });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

export default router;