import { Server as SocketServer } from 'socket.io';
import { addChatMessage, deleteChatMessage } from '../db/chats.js';
import { validateSessionAccess } from '../middleware/sessionAccess.js';

const activeChatUsers = new Map();
let sessionUsersIO = null;

export function setupChatWebsocket(httpServer, sessionUsersWebsocketIO) {
    sessionUsersIO = sessionUsersWebsocketIO;

    const io = new SocketServer(httpServer, {
        path: '/sockets/chat',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:5000', 'https://control.pfconnect.online', 'https://test.pfconnect.online'],
            credentials: true
        }
    });

    io.on('connection', async (socket) => {
        const sessionId = socket.handshake.query.sessionId;
        const accessId = socket.handshake.query.accessId;
        const userId = socket.handshake.query.userId;

        // Only validate access ID, not ownership
        const valid = await validateSessionAccess(sessionId, accessId);
        if (!valid) {
            socket.disconnect(true);
            return;
        }

        socket.join(sessionId);

        if (!activeChatUsers.has(sessionId)) {
            activeChatUsers.set(sessionId, new Set());
        }
        activeChatUsers.get(sessionId).add(userId);

        io.to(sessionId).emit('activeChatUsers', Array.from(activeChatUsers.get(sessionId)));

        socket.on('chatMessage', async ({ user, message }) => {
            if (!sessionId || message.length > 500) return;

            const mentions = parseMentions(message);

            const chatMsg = await addChatMessage(sessionId, {
                userId: user.userId,
                username: user.username,
                avatar: user.avatar,
                message,
                mentions
            });

            const formattedMsg = {
                id: chatMsg.id,
                userId: chatMsg.user_id,
                username: chatMsg.username,
                avatar: chatMsg.avatar,
                message: chatMsg.message,
                mentions: chatMsg.mentions,
                sent_at: chatMsg.sent_at
            };

            io.to(sessionId).emit('chatMessage', formattedMsg);

            if (mentions && mentions.length > 0 && sessionUsersIO) {
                const sessionUsers = sessionUsersIO.activeUsers?.get(sessionId) || [];

                mentions.forEach(mentionedUsername => {
                    const mentionedUser = sessionUsers.find(u => u.username === mentionedUsername);

                    if (mentionedUser) {
                        const mentionData = {
                            messageId: chatMsg.id,
                            mentionedUserId: mentionedUser.id,
                            mentionerUsername: user.username,
                            message,
                            sessionId,
                            timestamp: chatMsg.sent_at
                        };

                        sessionUsersIO.sendMentionToUser(mentionedUser.id, mentionData);
                    }
                });
            }
        });

        socket.on('deleteMessage', async ({ messageId, userId }) => {
            const success = await deleteChatMessage(sessionId, messageId, userId);
            if (success) {
                io.to(sessionId).emit('messageDeleted', { messageId });
            } else {
                socket.emit('deleteError', { messageId, error: 'Cannot delete this message' });
            }
        });

        socket.on('disconnect', () => {
            if (activeChatUsers.has(sessionId)) {
                activeChatUsers.get(sessionId).delete(userId);
                if (activeChatUsers.get(sessionId).size === 0) {
                    activeChatUsers.delete(sessionId);
                } else {
                    io.to(sessionId).emit('activeChatUsers', Array.from(activeChatUsers.get(sessionId)));
                }
            }
        });
    });

    return io;
}

function parseMentions(message) {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(message)) !== null) {
        mentions.push(match[1]);
    }
    return mentions;
}