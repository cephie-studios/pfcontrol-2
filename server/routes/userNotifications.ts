import express from 'express';
import requireAuth from '../middleware/auth.js';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../db/userNotifications.js';

const router = express.Router();

// GET: /api/user-notifications/unread - Unread alerts for the current user
router.get('/unread', requireAuth, async (req, res) => {
  try {
    const notifications = await getUserNotifications(
      req.user!.userId,
      true,
      50
    );
    res.json({ notifications });
  } catch (error) {
    console.error('Error fetching unread notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST: /api/user-notifications/:id/read - Dismiss one alert
router.post('/:id/read', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }
    const updated = await markNotificationAsRead(id, req.user!.userId);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// POST: /api/user-notifications/read-all - Dismiss every unread alert
router.post('/read-all', requireAuth, async (req, res) => {
  try {
    await markAllNotificationsAsRead(req.user!.userId);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

export default router;
