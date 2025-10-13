import express from 'express';
import { addChatMessage, getChatMessages, deleteChatMessage } from '../db/chats.js';
import requireAuth from '../middleware/isAuthenticated.js';
import { chatMessageLimiter } from '../middleware/rateLimiting.js';

const router = express.Router();

// GET: /api/chats/:sessionId - get recent messages
router.get('/:sessionId', requireAuth, async (req, res) => {
    try {
        const messages = await getChatMessages(req.params.sessionId);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
});

// POST: /api/chats/:sessionId - add a message (for fallback, not websocket)
router.post('/:sessionId', chatMessageLimiter, requireAuth, async (req, res) => {
    try {
        const { message } = req.body;
        if (message.length > 500) {
            return res.status(400).json({ error: 'Message too long' });
        }
        const user = req.user;
        const chatMsg = await addChatMessage(req.params.sessionId, {
            userId: user.userId,
            username: user.username,
            avatar: user.avatar,
            message
        });
        res.status(201).json(chatMsg);
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// DELETE: /api/chats/:sessionId/:messageId - delete own message
router.delete('/:sessionId/:messageId', requireAuth, async (req, res) => {
    try {
        const success = await deleteChatMessage(
            req.params.sessionId,
            req.params.messageId,
            req.user.userId
        );
        if (success) {
            res.json({ success: true });
        } else {
            res.status(403).json({ error: 'Cannot delete this message' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

export default router;