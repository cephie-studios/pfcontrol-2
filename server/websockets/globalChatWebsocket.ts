import { Server as SocketServer } from 'socket.io';
import { chatsDb, mainDb } from '../db/connection.js';
import { reportGlobalChatMessage } from '../db/chats.js';
import { sanitizeMessage } from '../utils/sanitization.js';
import {
  containsHateSpeech,
  getHateSpeechReason,
} from '../utils/hateSpeechFilter.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { sql } from 'kysely';
import type { Server } from 'http';

const activeGlobalChatUsers = new Set<string>();
const connectedGlobalChatUsers = new Map<
  string,
  {
    id: string;
    username: string;
    avatar: string | null;
    station: string | null;
    position: string | null;
    lastSeen: number;
  }
>();
let sessionUsersIO: SessionUsersWebsocketIO | null = null;

// Cleanup inactive users from connectedGlobalChatUsers
const cleanupInactiveGlobalUsers = () => {
  const now = Date.now();
  const INACTIVE_THRESHOLD = 5 * 60 * 1000;
  let removedCount = 0;
  
  for (const [userId, userData] of connectedGlobalChatUsers.entries()) {
    if (now - userData.lastSeen > INACTIVE_THRESHOLD) {
      connectedGlobalChatUsers.delete(userId);
      removedCount++;
    }
  }
  
  if (removedCount > 0) {
    console.log(`[GlobalChat] Cleaned up ${removedCount} inactive users`);
  }
};

const globalChatCleanupInterval = setInterval(cleanupInactiveGlobalUsers, 2 * 60 * 1000);

interface SessionUsersWebsocketIO {
  getActiveUsersForSession?(
    sessionId: string
  ): Promise<Array<{ id: string; username: string; position?: string }>>;
  sendMentionToUser(userId: string, mentionData: MentionData): void;
}

interface MentionData {
  messageId: string;
  mentionedUserId: string;
  mentionerUsername: string;
  message: string;
  sessionId?: string;
  airport?: string;
  timestamp: string;
  [key: string]: unknown;
}

interface GlobalChatMessage {
  id: number;
  user_id: string;
  username: string | null;
  avatar: string | null;
  station: string | null;
  position: string | null;
  message: string;
  airport_mentions: string[] | null;
  user_mentions: string[] | null;
  sent_at: Date;
  deleted_at: Date | null;
}

export function setupGlobalChatWebsocket(
  httpServer: Server,
  sessionUsersWebsocketIO: SessionUsersWebsocketIO
) {
  sessionUsersIO = sessionUsersWebsocketIO;

  const io = new SocketServer(httpServer, {
    path: '/sockets/global-chat',
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

  setInterval(
    async () => {
      try {
        await chatsDb
          .updateTable('global_chat')
          .set({ deleted_at: sql`(NOW() AT TIME ZONE 'UTC')` })
          .where((eb) =>
            eb(
              sql`sent_at`,
              '<',
              sql`(NOW() AT TIME ZONE 'UTC') - INTERVAL '30 minutes'`
            )
          )
          .where('deleted_at', 'is', null)
          .execute();
      } catch (error) {
        console.error('[Global Chat] Error cleaning old messages:', error);
      }
    },
    5 * 60 * 1000
  );

  io.on('connection', async (socket) => {
    const userId = Array.isArray(socket.handshake.query.userId)
      ? socket.handshake.query.userId[0]
      : socket.handshake.query.userId;

    const station = Array.isArray(socket.handshake.query.station)
      ? socket.handshake.query.station[0]
      : socket.handshake.query.station;

    const position = Array.isArray(socket.handshake.query.position)
      ? socket.handshake.query.position[0]
      : socket.handshake.query.position;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.data.userId = userId;
    socket.data.station = station;
    socket.data.position = position;

    socket.join('global-chat');
    socket.join(`user-${userId}`);

    if (station && !connectedGlobalChatUsers.has(userId)) {
      try {
        const user = await mainDb
          .selectFrom('users')
          .select(['username', 'avatar'])
          .where('id', '=', userId)
          .executeTakeFirst();

        let avatarUrl = null;
        if (user?.avatar) {
          avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`;
        }

        connectedGlobalChatUsers.set(userId, {
          id: userId,
          username: user?.username || 'Unknown',
          avatar: avatarUrl,
          station: station,
          position: position || null,
          lastSeen: Date.now(),
        });

        io.to('global-chat').emit(
          'connectedGlobalChatUsers',
          Array.from(connectedGlobalChatUsers.values())
        );
      } catch (error) {
        console.error('[Global Chat] Error fetching user data:', error);
        connectedGlobalChatUsers.set(userId, {
          id: userId,
          username: 'Unknown',
          avatar: null,
          station: station,
          position: position || null,
          lastSeen: Date.now(),
        });
        io.to('global-chat').emit(
          'connectedGlobalChatUsers',
          Array.from(connectedGlobalChatUsers.values())
        );
      }
    }

    socket.on('globalChatMessage', async ({ user, message }) => {
      if (!message || message.length > 500) return;

      const sanitizedMessage = sanitizeMessage(message, 500);
      if (!sanitizedMessage) return;

      if (socket.data.station) {
        const existingUser = connectedGlobalChatUsers.get(user.userId);

        let avatarUrl = user.avatar;
        if (user.avatar && !user.avatar.startsWith('http')) {
          avatarUrl = `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png`;
        }

        connectedGlobalChatUsers.set(user.userId, {
          id: user.userId,
          username: user.username || existingUser?.username || 'Unknown',
          avatar: avatarUrl || existingUser?.avatar || null,
          station: socket.data.station,
          position: socket.data.position || null,
          lastSeen: Date.now(),
        });
        io.to('global-chat').emit(
          'connectedGlobalChatUsers',
          Array.from(connectedGlobalChatUsers.values())
        );
      }

      const parsedAirportMentions = parseAirportMentions(sanitizedMessage);
      const parsedUserMentions = parseUserMentions(sanitizedMessage);

      const hasHateSpeech = containsHateSpeech(sanitizedMessage);
      const automodded = hasHateSpeech;
      const automodReason = hasHateSpeech
        ? getHateSpeechReason(sanitizedMessage)
        : undefined;

      const encryptedMsg = encrypt(sanitizedMessage);
      if (!encryptedMsg) {
        socket.emit('chatError', { message: 'Failed to encrypt message' });
        return;
      }

      try {
        const result = await chatsDb
          .insertInto('global_chat')
          .values({
            id: sql`DEFAULT`,
            user_id: user.userId,
            username: user.username ?? undefined,
            avatar: user.avatar ?? undefined,
            station: socket.data.station ?? undefined,
            position: socket.data.position ?? undefined,
            message: JSON.stringify(encryptedMsg),
            airport_mentions:
              parsedAirportMentions.length > 0
                ? JSON.stringify(parsedAirportMentions)
                : undefined,
            user_mentions:
              parsedUserMentions.length > 0
                ? JSON.stringify(parsedUserMentions)
                : undefined,
            sent_at: sql`NOW()`,
          })
          .returning([
            'id',
            'user_id',
            'username',
            'avatar',
            'station',
            'position',
            'message',
            'airport_mentions',
            'user_mentions',
            'sent_at',
          ])
          .executeTakeFirst();

        if (!result) {
          socket.emit('chatError', { message: 'Failed to send message' });
          return;
        }

        let decryptedMessage = '';
        try {
          if (result.message) {
            const encryptedData =
              typeof result.message === 'string'
                ? JSON.parse(result.message)
                : result.message;
            decryptedMessage = decrypt(encryptedData) || '';
          }
        } catch (e) {
          console.error('[Global Chat] Error decrypting message:', e);
          decryptedMessage = '';
        }

        let airportMentions = null;
        let userMentions = null;

        if (result.airport_mentions) {
          if (Array.isArray(result.airport_mentions)) {
            airportMentions = result.airport_mentions;
          } else if (
            typeof result.airport_mentions === 'string' &&
            result.airport_mentions.trim()
          ) {
            try {
              airportMentions = JSON.parse(result.airport_mentions);
            } catch (e) {
              console.error('[Global Chat] Error parsing airport mentions:', e);
              airportMentions = null;
            }
          }
        }

        if (result.user_mentions) {
          if (Array.isArray(result.user_mentions)) {
            userMentions = result.user_mentions;
          } else if (
            typeof result.user_mentions === 'string' &&
            result.user_mentions.trim()
          ) {
            try {
              userMentions = JSON.parse(result.user_mentions);
            } catch (e) {
              console.error('[Global Chat] Error parsing user mentions:', e);
              userMentions = null;
            }
          }
        }

        const chatMsg: GlobalChatMessage = {
          id: result.id,
          user_id: result.user_id,
          username: result.username ?? null,
          avatar: result.avatar ?? null,
          station: result.station ?? null,
          position: result.position ?? null,
          message: result.message,
          airport_mentions: airportMentions,
          user_mentions: userMentions,
          sent_at: result.sent_at ? new Date(result.sent_at) : new Date(),
          deleted_at: null,
        };

        const formattedMsg = {
          id: chatMsg.id,
          userId: chatMsg.user_id,
          username: chatMsg.username,
          avatar: chatMsg.avatar,
          station: chatMsg.station,
          position: chatMsg.position,
          message: decryptedMessage,
          airportMentions: chatMsg.airport_mentions,
          userMentions: chatMsg.user_mentions,
          sent_at: chatMsg.sent_at,
          automodded,
        };

        io.to('global-chat').emit('globalChatMessage', formattedMsg);

        if (automodded) {
          socket.emit('messageAutomodded', {
            messageId: chatMsg.id,
            reason: automodReason || 'Content violation detected',
          });

          try {
            await reportGlobalChatMessage(
              chatMsg.id,
              'automod',
              automodReason || 'Content violation detected'
            );
          } catch (error) {
            console.error(
              '[Global Chat] Error reporting automodded message:',
              error
            );
          }
        }

        if (userMentions && userMentions.length > 0) {
          try {
            const users = await mainDb
              .selectFrom('users')
              .select(['id', 'username'])
              .where('username', 'in', userMentions)
              .execute();

            for (const mentionedUser of users) {
              io.to(`user-${mentionedUser.id}`).emit('globalChatMention', {
                messageId: String(chatMsg.id),
                mentionedUserId: mentionedUser.id,
                mentionerUsername: user.username || 'Unknown',
                message: chatMsg.message,
                timestamp: chatMsg.sent_at.toISOString(),
              });
            }
          } catch (error) {
            console.error('[Global Chat] Error sending user mentions:', error);
          }
        }

        if (airportMentions && airportMentions.length > 0) {
          for (const airport of airportMentions) {
            io.to('global-chat').emit('airportMention', {
              airport: airport.toUpperCase(),
              messageId: String(chatMsg.id),
              mentionerUsername: user.username || 'Unknown',
              message: chatMsg.message,
              timestamp: chatMsg.sent_at.toISOString(),
            });
          }
        }
      } catch (error) {
        console.error('[Global Chat] Error adding message:', error);
        socket.emit('chatError', { message: 'Failed to send message' });
      }
    });

    socket.on('deleteGlobalMessage', async ({ messageId, userId }) => {
      try {
        const result = await chatsDb
          .updateTable('global_chat')
          .set({ deleted_at: sql`NOW()` })
          .where('id', '=', messageId)
          .where('user_id', '=', userId)
          .where('deleted_at', 'is', null)
          .executeTakeFirst();

        if (result.numUpdatedRows > 0) {
          io.to('global-chat').emit('globalMessageDeleted', { messageId });
        } else {
          socket.emit('deleteError', {
            messageId,
            error: 'Cannot delete this message',
          });
        }
      } catch (error) {
        console.error('[Global Chat] Error deleting message:', error);
        socket.emit('deleteError', {
          messageId,
          error: 'Failed to delete message',
        });
      }
    });

    socket.on('globalChatOpened', () => {
      const userId = socket.data.userId;
      if (userId) {
        activeGlobalChatUsers.add(userId);
        io.to('global-chat').emit(
          'activeGlobalChatUsers',
          Array.from(activeGlobalChatUsers)
        );
      }
    });

    socket.on('globalChatClosed', () => {
      const userId = socket.data.userId;
      if (userId) {
        activeGlobalChatUsers.delete(userId);
        io.to('global-chat').emit(
          'activeGlobalChatUsers',
          Array.from(activeGlobalChatUsers)
        );
      }
    });

    socket.on('disconnect', () => {
      const userId = socket.data.userId;
      if (userId) {
        activeGlobalChatUsers.delete(userId);
        connectedGlobalChatUsers.delete(userId);
        io.to('global-chat').emit(
          'activeGlobalChatUsers',
          Array.from(activeGlobalChatUsers)
        );
        io.to('global-chat').emit(
          'connectedGlobalChatUsers',
          Array.from(connectedGlobalChatUsers.values())
        );
      }
    });
  });

  // Cleanup on shutdown
  process.on('SIGTERM', () => {
    console.log('[GlobalChat] Cleaning up intervals...');
    clearInterval(globalChatCleanupInterval);
    connectedGlobalChatUsers.clear();
    activeGlobalChatUsers.clear();
  });

  return io;
}

function parseAirportMentions(message: string): string[] {
  const airportRegex = /@([A-Za-z]{4})\b/g;
  const mentions: string[] = [];
  let match;
  while ((match = airportRegex.exec(message)) !== null) {
    mentions.push(match[1].toUpperCase());
  }
  return mentions;
}

function parseUserMentions(message: string): string[] {
  const userRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = userRegex.exec(message)) !== null) {
    const mention = match[1];
    if (!(mention.length === 4 && mention === mention.toUpperCase())) {
      mentions.push(mention);
    }
  }
  return mentions;
}
