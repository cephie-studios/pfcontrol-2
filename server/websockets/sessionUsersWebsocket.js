import { Server as SocketServer } from 'socket.io';
import { validateSessionAccess } from '../middleware/sessionAccess.js';

const activeUsers = new Map();

export function setupSessionUsersWebsocket(httpServer) {
    const io = new SocketServer(httpServer, {
        path: '/sockets/session-users',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:5000', 'https://control.pfconnect.online'],
            credentials: true
        }
    });

    io.on('connection', async (socket) => {
        const sessionId = socket.handshake.query.sessionId;
        const accessId = socket.handshake.query.accessId;
        const user = JSON.parse(socket.handshake.query.user);
        const valid = await validateSessionAccess(sessionId, accessId);
        if (!valid || !user) {
            socket.disconnect(true);
            return;
        }

        if (!activeUsers.has(sessionId)) {
            activeUsers.set(sessionId, []);
        }
        const users = activeUsers.get(sessionId);
        const sessionUser = {
            id: user.userId,
            username: user.username,
            avatar: user.avatar || null,
            joinedAt: Date.now(),
            position: socket.handshake.query.position || 'POSITION'
        };
        const existingUserIndex = users.findIndex(u => u.id === sessionUser.id);
        if (existingUserIndex === -1) {
            users.push(sessionUser);
        } else {
            users[existingUserIndex] = sessionUser;
        }

        socket.join(sessionId);
        socket.join(`user-${user.userId}`);

        io.to(sessionId).emit('sessionUsersUpdate', users);

        socket.on('disconnect', () => {
            const users = activeUsers.get(sessionId);
            if (users) {
                const index = users.findIndex(u => u.id === user.userId);
                if (index !== -1) {
                    users.splice(index, 1);
                }
                if (users.length === 0) {
                    activeUsers.delete(sessionId);
                } else {
                    io.to(sessionId).emit('sessionUsersUpdate', users);
                }
            }
        });
    });

    io.sendMentionToUser = (userId, mention) => {
        io.to(`user-${userId}`).emit('chatMention', mention);
    };

    io.activeUsers = activeUsers;

    return io;
}