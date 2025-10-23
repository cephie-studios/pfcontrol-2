import { Server as SocketServer } from 'socket.io';
import { addChatMessage, deleteChatMessage } from '../db/chats.js';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { validateSessionId, validateAccessId } from '../utils/validation.js';
import { sanitizeMessage } from '../utils/sanitization.js';
import type { Server } from 'http';

const activeChatUsers = new Map();
let sessionUsersIO: SessionUsersWebsocketIO | null = null;

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
    sendMentionToUser(userId: string, mentionData: MentionData): void;
}

export function setupChatWebsocket(httpServer: Server, sessionUsersWebsocketIO: SessionUsersWebsocketIO) {
    sessionUsersIO = sessionUsersWebsocketIO;

    const io = new SocketServer(httpServer, {
        path: '/sockets/chat',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:9901', 'https://control.pfconnect.online', 'https://test.pfconnect.online'],
            credentials: true
        }
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

          if (!activeChatUsers.has(sessionId)) {
              activeChatUsers.set(sessionId, new Set());
          }
          activeChatUsers.get(sessionId).add(userId);

          io.to(sessionId).emit('activeChatUsers', Array.from(activeChatUsers.get(sessionId)));

          socket.on('chatMessage', async ({ user, message }) => {
            const sessionId = socket.data.sessionId;
            if (!sessionId || !message || message.length > 500) return;

            const sanitizedMessage = sanitizeMessage(message, 500);
            if (!sanitizedMessage) return;

            const mentions = parseMentions(sanitizedMessage);

            try {
                const chatMsg = await addChatMessage(sessionId, {
                    userId: user.userId,
                    username: user.username,
                    avatar: user.avatar,
                    message: sanitizedMessage,
                    mentions,
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

                if (sessionUsersIO?.activeUsers && mentions.length > 0) {
                    const users = sessionUsersIO.activeUsers.get(sessionId);
                    if (users) {
                        const messageIdStr = chatMsg.id?.toString() ?? '';
                        const timestampStr = chatMsg.sent_at ? chatMsg.sent_at.toISOString() : new Date().toISOString();
                        for (const username of mentions) {
                            const mentionedUser = users.find(u => u.username === username);
                            if (mentionedUser) {
                                sessionUsersIO.sendMentionToUser(mentionedUser.id, {
                                    messageId: messageIdStr,
                                    mentionedUserId: mentionedUser.id,
                                    mentionerUsername: user.username,
                                    message: sanitizedMessage,
                                    sessionId,
                                    timestamp: timestampStr,
                                });
                            }
                        }
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
                socket.emit('deleteError', { messageId, error: 'Cannot delete this message' });
            }
        });

        socket.on('disconnect', () => {
            const sessionId = socket.data.sessionId;
            const userId = socket.data.userId;
            if (activeChatUsers.has(sessionId)) {
                activeChatUsers.get(sessionId).delete(userId);
                if (activeChatUsers.get(sessionId).size === 0) {
                    activeChatUsers.delete(sessionId);
                } else {
                    io.to(sessionId).emit('activeChatUsers', Array.from(activeChatUsers.get(sessionId)));
                }
            }
        });

        } catch {
            console.error('Invalid session or access ID');
            socket.disconnect(true);
        }
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