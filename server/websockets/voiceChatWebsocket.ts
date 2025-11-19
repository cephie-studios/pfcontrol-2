import { Server as SocketServer } from 'socket.io';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { validateSessionId, validateAccessId } from '../utils/validation.js';
import { mainDb } from '../db/connection.js';
import type { Server } from 'http';

interface VoiceUser {
    userId: string;
    username: string;
    avatar: string | null;
    socketId: string;
    isMuted: boolean;
    isDeafened: boolean;
    isTalking: boolean;
    audioLevel: number;
    lastActivity: number;
}

const voiceUsers = new Map<string, Map<string, VoiceUser>>();
const userSessions = new Map<string, string>();

export function setupVoiceChatWebsocket(httpServer: Server) {
    const io = new SocketServer(httpServer, {
        path: '/sockets/voice-chat',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:9901', 'https://control.pfconnect.online', 'https://test.pfconnect.online'],
            credentials: true
        }
    });

    setInterval(() => {
        const now = Date.now();
        voiceUsers.forEach((sessionUsers, sessionId) => {
            sessionUsers.forEach((user, userId) => {
                if (now - user.lastActivity > 60000) {
                    sessionUsers.delete(userId);
                    userSessions.delete(userId);
                    
                    io.to(sessionId).emit('user-left-voice', {
                        userId: user.userId,
                        username: user.username
                    });
                    
                    broadcastVoiceUsers(sessionId);
                }
            });
            
            if (sessionUsers.size === 0) {
                voiceUsers.delete(sessionId);
            }
        });
    }, 30000);

    const broadcastVoiceUsers = (sessionId: string) => {
        const sessionUsers = voiceUsers.get(sessionId);
        if (sessionUsers) {
            const users = Array.from(sessionUsers.values()).map(user => ({
                userId: user.userId,
                username: user.username,
                avatar: user.avatar,
                isMuted: user.isMuted,
                isDeafened: user.isDeafened,
                isTalking: user.isTalking,
                audioLevel: user.audioLevel
            }));
            
            io.to(sessionId).emit('voice-users-update', users);
        }
    };

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

            if (!userId) {
                socket.disconnect(true);
                return;
            }

            const valid = await validateSessionAccess(sessionId, accessId);
            if (!valid) {
                socket.disconnect(true);
                return;
            }

            socket.data.sessionId = sessionId;
            socket.data.userId = userId;
            socket.join(sessionId);

            socket.on('join-voice-session', async () => {
                try {
                    const userInfo = await mainDb
                        .selectFrom('users')
                        .select(['username', 'avatar'])
                        .where('id', '=', userId)
                        .executeTakeFirst();

                    let avatarUrl = null;
                    if (userInfo?.avatar) {
                        avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${userInfo.avatar}.png?size=256`;
                    }

                    const username = userInfo?.username || `User${userId.slice(-4)}`;

                    if (!voiceUsers.has(sessionId)) {
                        voiceUsers.set(sessionId, new Map());
                    }

                    const sessionUsers = voiceUsers.get(sessionId)!;
                    const voiceUser: VoiceUser = {
                        userId,
                        username,
                        avatar: avatarUrl,
                        socketId: socket.id,
                        isMuted: false,
                        isDeafened: false,
                        isTalking: false,
                        audioLevel: 0,
                        lastActivity: Date.now()
                    };

                    sessionUsers.set(userId, voiceUser);
                    userSessions.set(userId, sessionId);

                    socket.to(sessionId).emit('user-joined-voice', {
                        userId,
                        username,
                        avatar: avatarUrl
                    });

                    socket.emit('voice-connected');
                    broadcastVoiceUsers(sessionId);
                } catch (error) {
                    console.error('[Voice Chat] Error joining voice session:', error);
                    socket.emit('voice-error', { message: 'Failed to join voice session' });
                }
            });

            socket.on('voice-offer', ({ targetUserId, offer }) => {
                const targetSocket = Array.from(io.sockets.sockets.values())
                    .find(s => s.data.userId === targetUserId && s.data.sessionId === sessionId);
                
                if (targetSocket) {
                    targetSocket.emit('voice-offer', {
                        fromUserId: userId,
                        offer
                    });
                }
            });

            socket.on('voice-answer', ({ targetUserId, answer }) => {
                const targetSocket = Array.from(io.sockets.sockets.values())
                    .find(s => s.data.userId === targetUserId && s.data.sessionId === sessionId);
                
                if (targetSocket) {
                    targetSocket.emit('voice-answer', {
                        fromUserId: userId,
                        answer
                    });
                }
            });

            socket.on('ice-candidate', ({ targetUserId, candidate }) => {
                const targetSocket = Array.from(io.sockets.sockets.values())
                    .find(s => s.data.userId === targetUserId && s.data.sessionId === sessionId);
                
                if (targetSocket) {
                    targetSocket.emit('ice-candidate', {
                        fromUserId: userId,
                        candidate
                    });
                }
            });

            socket.on('mute-state', ({ isMuted }) => {
                const sessionUsers = voiceUsers.get(sessionId);
                const user = sessionUsers?.get(userId);
                
                if (user) {
                    user.isMuted = isMuted;
                    user.lastActivity = Date.now();
                    broadcastVoiceUsers(sessionId);
                }
            });

            socket.on('deafen-state', ({ isDeafened }) => {
                const sessionUsers = voiceUsers.get(sessionId);
                const user = sessionUsers?.get(userId);
                
                if (user) {
                    user.isDeafened = isDeafened;
                    user.lastActivity = Date.now();
                    broadcastVoiceUsers(sessionId);
                }
            });

            socket.on('audioLevel', ({ level, isTalking }) => {
                const sessionUsers = voiceUsers.get(sessionId);
                const user = sessionUsers?.get(userId);
                
                if (user) {
                    const wasNotTalking = !user.isTalking;
                    user.audioLevel = level;
                    user.isTalking = isTalking;
                    user.lastActivity = Date.now();
                    
                    if (wasNotTalking && isTalking) {
                        socket.to(sessionId).emit('user-talking-state', {
                            userId,
                            isTalking: true
                        });
                    } else if (!wasNotTalking && !isTalking) {
                        socket.to(sessionId).emit('user-talking-state', {
                            userId,
                            isTalking: false
                        });
                    }
                    
                    if (Math.random() < 0.1) {
                        broadcastVoiceUsers(sessionId);
                    }
                }
            });

            socket.on('leave-voice-session', () => {
                handleUserLeave();
            });

            socket.on('request-reconnection', ({ targetUserId }) => {
                const targetSocket = Array.from(io.sockets.sockets.values())
                    .find(s => s.data.userId === targetUserId && s.data.sessionId === sessionId);
                
                if (targetSocket) {
                    targetSocket.emit('reconnection-requested', { fromUserId: userId });
                }
            });

            const handleUserLeave = () => {
                const sessionUsers = voiceUsers.get(sessionId);
                if (sessionUsers?.has(userId)) {
                    const user = sessionUsers.get(userId)!;
                    sessionUsers.delete(userId);
                    userSessions.delete(userId);

                    socket.to(sessionId).emit('user-left-voice', {
                        userId: user.userId,
                        username: user.username
                    });

                    broadcastVoiceUsers(sessionId);
                }
            };

            socket.on('disconnect', () => {
                handleUserLeave();
            });

        } catch (error) {
            console.error('[Voice Chat] Connection error:', error);
            socket.disconnect(true);
        }
    });

    return io;
}