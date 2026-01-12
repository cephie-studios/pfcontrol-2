import { Server as SocketServer } from 'socket.io';
import {
  addChatMessage,
  deleteChatMessage,
  reportChatMessage,
} from '../db/chats.js';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { validateSessionId, validateAccessId } from '../utils/validation.js';
import { sanitizeMessage } from '../utils/sanitization.js';
import type { Server } from 'http';

const activeChatUsers = new Map<string, Set<string>>();
let sessionUsersIO: SessionUsersWebsocketIO | null = null;

// Cleanup empty chat user sets periodically
const cleanupChatUsers = () => {
  let removedCount = 0;
  for (const [sessionId, userSet] of activeChatUsers.entries()) {
    if (userSet.size === 0) {
      activeChatUsers.delete(sessionId);
      removedCount++;
    }
  }
  if (removedCount > 0) {
    console.log(`[Chat] Cleaned up ${removedCount} empty session user sets`);
  }
};

const chatCleanupInterval = setInterval(cleanupChatUsers, 5 * 60 * 1000);

interface MentionData {
  messageId: string;
  mentionedUserId: string;
  mentionerUsername: string;
  message: string;
  sessionId: string;
  timestamp: string;
  [key: string]: unknown;
}

interface SessionUsersWebsocketIO {
  activeUsers?: Map<string, Array<{ id: string; username: string }>>;
  getActiveUsersForSession?(
    sessionId: string
  ): Promise<Array<{ id: string; username: string }>>;
  sendMentionToUser(userId: string, mentionData: MentionData): void;
}

export function setupChatWebsocket(
  httpServer: Server,
  sessionUsersWebsocketIO: SessionUsersWebsocketIO
) {
  sessionUsersIO = sessionUsersWebsocketIO;

  const io = new SocketServer(httpServer, {
    path: '/sockets/chat',
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:9901',
        'https://control.pfconnect.online',
        'https://canary.pfconnect.online',
      ],
      credentials: true,
    },
  });

  io.on('connection', async (socket) => {
    try {
      const sessionId = validateSessionId(
        Array.isArray(socket.handshake.query.sessionId)
          ? socket.handshake.query.sessionId[0]
          : socket.handshake.query.sessionId
      );
      const accessId = validateAccessId(
        Array.isArray(socket.handshake.query.accessId)
          ? socket.handshake.query.accessId[0]
          : socket.handshake.query.accessId
      );
      const userId = Array.isArray(socket.handshake.query.userId)
        ? socket.handshake.query.userId[0]
        : socket.handshake.query.userId;

      const valid = await validateSessionAccess(sessionId, accessId);
      if (!valid) {
        socket.disconnect(true);
        return;
      }

      socket.data.sessionId = sessionId;
      socket.data.userId = userId;

      socket.join(sessionId);

      socket.on('chatMessage', async ({ user, message }) => {
        const sessionId = socket.data.sessionId;
        if (!sessionId || !message || message.length > 500) return;

        const sanitizedMessage = sanitizeMessage(message, 500);
        if (!sanitizedMessage) return;

        const mentionedUsernames = parseMentions(sanitizedMessage);

        let mentionedUserIds: string[] = [];
        if (
          sessionUsersIO?.getActiveUsersForSession &&
          mentionedUsernames.length > 0
        ) {
          try {
            const users =
              await sessionUsersIO.getActiveUsersForSession(sessionId);
            mentionedUserIds = mentionedUsernames
              .map((username) => users.find((u) => u.username === username)?.id)
              .filter((id): id is string => id !== undefined);
          } catch (error) {
            console.error('Error resolving mentions:', error);
          }
        }

        try {
          const chatMsg = await addChatMessage(sessionId, {
            userId: user.userId,
            username: user.username,
            avatar: user.avatar,
            message: sanitizedMessage,
            mentions: mentionedUserIds,
          });

          const formattedMsg = {
            id: chatMsg.id,
            userId: chatMsg.user_id,
            username: chatMsg.username,
            avatar: chatMsg.avatar,
            message: chatMsg.message,
            mentions: chatMsg.mentions,
            sent_at: chatMsg.sent_at,
          };

          io.to(sessionId).emit('chatMessage', formattedMsg);

          if (chatMsg.automodded && chatMsg.id) {
            socket.emit('messageAutomodded', {
              messageId: chatMsg.id,
              reason: chatMsg.automodReason || 'Hate speech detected',
            });
            try {
              await reportChatMessage(
                sessionId,
                chatMsg.id,
                'automod',
                chatMsg.automodReason || 'Hate speech detected'
              );
            } catch (error) {
              console.error('Error reporting automodded message:', error);
            }
          }

          if (
            sessionUsersIO?.sendMentionToUser &&
            mentionedUserIds.length > 0
          ) {
            try {
              const messageIdStr = chatMsg.id?.toString() ?? '';
              const timestampStr = chatMsg.sent_at
                ? chatMsg.sent_at.toISOString()
                : new Date().toISOString();
              for (const userId of mentionedUserIds) {
                sessionUsersIO.sendMentionToUser(userId, {
                  messageId: messageIdStr,
                  mentionedUserId: userId,
                  mentionerUsername: user.username,
                  message: sanitizedMessage,
                  sessionId,
                  timestamp: timestampStr,
                });
              }
            } catch (error) {
              console.error('Error sending mentions:', error);
            }
          }
        } catch (error) {
          console.error('Error adding chat message:', error);
          socket.emit('chatError', { message: 'Failed to send message' });
        }
      });

      socket.on('deleteMessage', async ({ messageId, userId }) => {
        const sessionId = socket.data.sessionId;
        const success = await deleteChatMessage(sessionId, messageId, userId);
        if (success) {
          io.to(sessionId).emit('messageDeleted', { messageId });
        } else {
          socket.emit('deleteError', {
            messageId,
            error: 'Cannot delete this message',
          });
        }
      });

      socket.on('chatOpened', () => {
        const sessionId = socket.data.sessionId;
        const userId = socket.data.userId;
        if (sessionId && userId) {
          if (!activeChatUsers.has(sessionId)) {
            activeChatUsers.set(sessionId, new Set());
          }
          const userSet = activeChatUsers.get(sessionId);
          if (userSet) {
            userSet.add(userId);
            io.to(sessionId).emit(
              'activeChatUsers',
              Array.from(userSet)
            );
          }
        }
      });

      socket.on('chatClosed', () => {
        const sessionId = socket.data.sessionId;
        const userId = socket.data.userId;
        if (sessionId && userId && activeChatUsers.has(sessionId)) {
          const userSet = activeChatUsers.get(sessionId);
          if (userSet) {
            userSet.delete(userId);
            io.to(sessionId).emit(
              'activeChatUsers',
              Array.from(userSet)
            );
          }
        }
      });

      socket.on('disconnect', () => {
        const sessionId = socket.data.sessionId;
        const userId = socket.data.userId;
        if (activeChatUsers.has(sessionId)) {
          const userSet = activeChatUsers.get(sessionId);
          if (userSet) {
            userSet.delete(userId);
            if (userSet.size === 0) {
              activeChatUsers.delete(sessionId);
            } else {
              io.to(sessionId).emit(
                'activeChatUsers',
                Array.from(userSet)
              );
            }
          }
        }
      });
    } catch {
      console.error('Invalid session or access ID');
      socket.disconnect(true);
    }
  });

  // Cleanup on shutdown
  process.on('SIGTERM', () => {
    console.log('[Chat] Cleaning up intervals...');
    clearInterval(chatCleanupInterval);
    activeChatUsers.clear();
  });

  return io;
}

function parseMentions(message: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(message)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}
