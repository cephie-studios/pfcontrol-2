import express from 'express';
import { addChatMessage, getChatMessages, deleteChatMessage } from '../db/chats.js';
import { chatMessageLimiter } from '../middleware/rateLimiting.js';
import requireAuth from '../middleware/auth.js';

const router = express.Router();

// GET: /api/chats/:sessionId
router.get('/:sessionId', requireAuth, async (req, res) => {
    try {
        const messages = await getChatMessages(req.params.sessionId);
        res.json(messages);
    } catch {
        res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
});

// POST: /api/chats/:sessionId
router.post('/:sessionId', chatMessageLimiter, requireAuth, async (req, res) => {
    try {
        const { message } = req.body;
        if (typeof message !== 'string' || message.length > 500) {
            return res.status(400).json({ error: 'Message too long' });
        }
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const chatMsg = await addChatMessage(req.params.sessionId, {
            userId: user.userId,
            username: user.username,
            avatar: user.avatar ?? '',
            message
        });
        res.status(201).json(chatMsg);
    } catch {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// DELETE: /api/chats/:sessionId/:messageId
router.delete('/:sessionId/:messageId', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const messageId = Number(req.params.messageId);
        if (isNaN(messageId)) {
            return res.status(400).json({ error: 'Invalid message ID' });
        }
        const success = await deleteChatMessage(
            req.params.sessionId,
            messageId,
            user.userId
        );
        if (success) {
            res.json({ success: true });
        } else {
            res.status(403).json({ error: 'Cannot delete this message' });
        }
    } catch {
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

export default router;