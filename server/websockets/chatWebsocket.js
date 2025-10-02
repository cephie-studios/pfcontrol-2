import { Server as SocketServer } from 'socket.io';
import { addChatMessage } from '../db/chats.js';
import { validateSessionAccess } from '../middleware/sessionAccess.js';

export function setupChatWebsocket(httpServer) {
    const io = new SocketServer(httpServer, {
        path: '/sockets/chat',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:5000', 'https://control.pfconnect.online'],
            credentials: true
        }
    });

    io.on('connection', async (socket) => {
        const sessionId = socket.handshake.query.sessionId;
        const accessId = socket.handshake.query.accessId;

        const valid = await validateSessionAccess(sessionId, accessId);
        if (!valid) {
            socket.disconnect(true);
            return;
        }

        socket.join(sessionId);

        socket.on('chatMessage', async ({ user, message }) => {
            if (!sessionId) return;
            const chatMsg = await addChatMessage(sessionId, {
                userId: user.userId,
                username: user.username,
                avatar: user.avatar,
                message
            });

            const formattedMsg = {
                id: chatMsg.id,
                userId: chatMsg.user_id,
                username: chatMsg.username,
                avatar: chatMsg.avatar,
                message: chatMsg.message,
                sent_at: chatMsg.sent_at
            };

            io.to(sessionId).emit('chatMessage', formattedMsg);
        });
    });
}