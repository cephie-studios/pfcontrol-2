import { Server as SocketServer } from 'socket.io';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { validateSessionId, validateAccessId } from '../utils/validation.js';
import { mainDb } from '../db/connection.js';
import type { Server } from 'http';
import { createHandshakeRateLimiter } from './handshakeRateLimit.js';

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

const sessionSocketMap = new Map<string, Map<string, string>>();
const voiceUsers = new Map<string, Map<string, VoiceUser>>();

export function setupVoiceChatWebsocket(httpServer: Server) {
  const io = new SocketServer(httpServer, {
    path: '/sockets/voice-chat',
    allowRequest: createHandshakeRateLimiter({
      scope: 'voice-chat',
      maxAttempts: 500,
    }),
    cors: {
      origin:
        process.env.NODE_ENV === 'production'
          ? ['https://pfcontrol.com', 'https://canary.pfcontrol.com']
          : ['http://localhost:9901', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Allow-Credentials',
      ],
    },
    perMessageDeflate: {
      threshold: 512,
    },
  });

  const getSessionUsersData = (sessionId: string) => {
    const users = voiceUsers.get(sessionId);
    if (!users) return [];
    return Array.from(users.values()).map(u => ({
      userId: u.userId,
      username: u.username,
      avatar: u.avatar,
      isMuted: u.isMuted,
      isDeafened: u.isDeafened,
      isTalking: u.isTalking,
      audioLevel: u.audioLevel
    }));
  };

  const broadcastVoiceUsers = (sessionId: string) => {
    io.to(sessionId).emit('voice-users-update', getSessionUsersData(sessionId));
  };

  io.on('connection', async (socket) => {
    const { sessionId: rawSessionId, accessId: rawAccessId, userId } = socket.handshake.query;

    try {
      if (!userId || typeof userId !== 'string') {
        socket.disconnect(true);
        return;
      }

      const sessionId = validateSessionId(Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId as string);
      const accessId = validateAccessId(Array.isArray(rawAccessId) ? rawAccessId[0] : rawAccessId as string);

      const valid = await validateSessionAccess(sessionId, accessId);
      if (!valid) {
        socket.disconnect(true);
        return;
      }

      socket.data.sessionId = sessionId;
      socket.data.userId = userId;
      socket.join(sessionId);

      if (!sessionSocketMap.has(sessionId)) sessionSocketMap.set(sessionId, new Map());
      sessionSocketMap.get(sessionId)!.set(userId, socket.id);

      socket.on('get-voice-users', () => {
        socket.emit('voice-users-update', getSessionUsersData(sessionId));
      });

      socket.on('join-voice-session', async () => {
        try {
          const userInfo = await mainDb
            .selectFrom('users')
            .select(['username', 'avatar'])
            .where('id', '=', userId)
            .executeTakeFirst();

          const username = userInfo?.username || `User${userId.slice(-4)}`;
          let avatarUrl = null;
          if (userInfo?.avatar) {
            avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${userInfo.avatar}.png?size=256`;
          }

          if (!voiceUsers.has(sessionId)) voiceUsers.set(sessionId, new Map());
          if (!sessionSocketMap.has(sessionId)) sessionSocketMap.set(sessionId, new Map());

          const usersInSession = voiceUsers.get(sessionId)!;
          const socketsInSession = sessionSocketMap.get(sessionId)!;

          const voiceUser: VoiceUser = {
            userId,
            username,
            avatar: avatarUrl,
            socketId: socket.id,
            isMuted: false,
            isDeafened: false,
            isTalking: false,
            audioLevel: 0,
            lastActivity: Date.now(),
          };

          usersInSession.set(userId, voiceUser);
          socketsInSession.set(userId, socket.id);

          socket.to(sessionId).emit('user-joined-voice', {
            userId,
            username,
            avatar: avatarUrl,
          });

          const existingPeerIds = Array.from(usersInSession.keys()).filter(
            (id) => id !== userId
          );
          if (existingPeerIds.length > 0) {
            socket.emit('voice-peers', { peerIds: existingPeerIds });
          }

          socket.emit('voice-connected');
          broadcastVoiceUsers(sessionId);
        } catch (err) {
          console.error('[VoiceChat] Join error:', err);
          socket.emit('voice-error', { message: 'Failed to join voice' });
        }
      });

      socket.on('voice-offer', ({ targetUserId, offer }) => {
        const targetSocketId = sessionSocketMap.get(sessionId)?.get(targetUserId);
        if (targetSocketId) {
          socket.to(targetSocketId).emit('voice-offer', { fromUserId: userId, offer });
        }
      });

      socket.on('voice-answer', ({ targetUserId, answer }) => {
        const targetSocketId = sessionSocketMap.get(sessionId)?.get(targetUserId);
        if (targetSocketId) {
          socket.to(targetSocketId).emit('voice-answer', { fromUserId: userId, answer });
        }
      });

      socket.on('ice-candidate', ({ targetUserId, candidate }) => {
        const targetSocketId = sessionSocketMap.get(sessionId)?.get(targetUserId);
        if (targetSocketId) {
          socket.to(targetSocketId).emit('ice-candidate', { fromUserId: userId, candidate });
        }
      });

      socket.on('mute-state', ({ isMuted }) => {
        const user = voiceUsers.get(sessionId)?.get(userId);
        if (user) {
          user.isMuted = isMuted;
          broadcastVoiceUsers(sessionId);
        }
      });

      socket.on('deafen-state', ({ isDeafened }) => {
        const user = voiceUsers.get(sessionId)?.get(userId);
        if (user) {
          user.isDeafened = isDeafened;
          broadcastVoiceUsers(sessionId);
        }
      });

      socket.on('audioLevel', ({ level, isTalking }) => {
        const user = voiceUsers.get(sessionId)?.get(userId);
        if (user) {
          const stateChanged = user.isTalking !== isTalking;
          user.audioLevel = level;
          user.isTalking = isTalking;
          user.lastActivity = Date.now();

          if (stateChanged) {
            socket.to(sessionId).emit('user-talking-state', { userId, isTalking });
          }
        }
      });

      const handleLeaveVoice = () => {
        const users = voiceUsers.get(sessionId);

        if (users?.has(userId)) {
          // Reconnection guard: only clean up if this socket is the active one
          if (users.get(userId)?.socketId !== socket.id) {
            console.log(`[VoiceChat] User ${userId} leaving voice from stale socket ${socket.id}, ignoring.`);
            return;
          }

          users.delete(userId);

          socket.to(sessionId).emit('user-left-voice', { userId });
          broadcastVoiceUsers(sessionId);

          if (users.size === 0) voiceUsers.delete(sessionId);
        }
      };

      const handleDisconnect = () => {
        handleLeaveVoice();

        const lookups = sessionSocketMap.get(sessionId);
        if (lookups) {
          if (lookups.get(userId) === socket.id) lookups.delete(userId);
          if (lookups.size === 0) sessionSocketMap.delete(sessionId);
        }
      };

      socket.on('leave-voice-session', handleLeaveVoice);
      socket.on('disconnect', handleDisconnect);

      socket.on('request-reconnection', ({ targetUserId }) => {
        const targetSocketId = sessionSocketMap.get(sessionId)?.get(targetUserId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('reconnection-requested', { fromUserId: userId });
        }
      });

    } catch (err) {
      console.error('[VoiceChat] Connection processing error:', err);
      socket.disconnect(true);
    }
  });

  return io;
}
