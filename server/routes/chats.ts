import express from 'express';
import {
  addChatMessage,
  getChatMessages,
  deleteChatMessage,
  reportChatMessage,
  reportGlobalChatMessage,
} from '../db/chats.js';
import { chatMessageLimiter } from '../middleware/rateLimiting.js';
import requireAuth from '../middleware/auth.js';
import { chatsDb } from '../db/connection.js';
import { decrypt } from '../utils/encryption.js';
import { sql } from 'kysely';

const router = express.Router();

// Global chat routes - MUST be defined before parameterized routes to avoid conflicts

// POST: /api/chats/global/:messageId/report - Report a global chat message
router.post('/global/:messageId/report', requireAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    if (typeof reason !== 'string' || reason.length > 500) {
      return res.status(400).json({ error: 'Invalid or too long reason' });
    }
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const messageId = Number(req.params.messageId);
    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    await reportGlobalChatMessage(messageId, user.userId, reason);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Global chat report error:', error);
    res.status(500).json({ error: 'Failed to report message' });
  }
});

// GET: /api/chats/global - Get global chat messages (last 30 minutes)
router.get('/global/messages', requireAuth, async (req, res) => {
  try {
    const messages = await chatsDb
      .selectFrom('global_chat')
      .selectAll()
      .where((eb) =>
        eb(
          sql`sent_at`,
          '>=',
          sql`(NOW() AT TIME ZONE 'UTC') - INTERVAL '30 minutes'`
        )
      )
      .where('deleted_at', 'is', null)
      .orderBy('sent_at', 'asc')
      .execute();

    const formattedMessages = messages.map((msg) => {
      let decryptedMessage = '';
      try {
        if (msg.message) {
          const encryptedData =
            typeof msg.message === 'string'
              ? JSON.parse(msg.message)
              : msg.message;
          decryptedMessage = decrypt(encryptedData) || '';
        }
      } catch (e) {
        console.error('[Global Chat] Error decrypting message:', e);
        decryptedMessage = '';
      }

      let airportMentions = null;
      let userMentions = null;

      // Handle airport mentions (could be array if jsonb column, or string if text column)
      if (msg.airport_mentions) {
        if (Array.isArray(msg.airport_mentions)) {
          airportMentions = msg.airport_mentions;
        } else if (
          typeof msg.airport_mentions === 'string' &&
          msg.airport_mentions.trim()
        ) {
          try {
            airportMentions = JSON.parse(msg.airport_mentions);
          } catch (e) {
            airportMentions = null;
          }
        }
      }

      // Handle user mentions (could be array if jsonb column, or string if text column)
      if (msg.user_mentions) {
        if (Array.isArray(msg.user_mentions)) {
          userMentions = msg.user_mentions;
        } else if (
          typeof msg.user_mentions === 'string' &&
          msg.user_mentions.trim()
        ) {
          try {
            userMentions = JSON.parse(msg.user_mentions);
          } catch (e) {
            userMentions = null;
          }
        }
      }

      return {
        id: msg.id,
        userId: msg.user_id,
        username: msg.username,
        avatar: msg.avatar,
        station: msg.station,
        position: msg.position,
        message: decryptedMessage, // Return decrypted message
        airportMentions,
        userMentions,
        sent_at: msg.sent_at,
      };
    });

    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching global chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch global chat messages' });
  }
});

// Session chat routes - defined after global routes to avoid param conflicts

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
router.post(
  '/:sessionId',
  chatMessageLimiter,
  requireAuth,
  async (req, res) => {
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
        message,
      });
      res.status(201).json(chatMsg);
    } catch {
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

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

// POST: /api/chats/:sessionId/:messageId/report
router.post('/:sessionId/:messageId/report', requireAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    if (typeof reason !== 'string' || reason.length > 500) {
      return res.status(400).json({ error: 'Invalid or too long reason' });
    }
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const messageId = Number(req.params.messageId);
    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    await reportChatMessage(
      req.params.sessionId,
      messageId,
      user.userId,
      reason
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Failed to report message' });
  }
});

export default router;
