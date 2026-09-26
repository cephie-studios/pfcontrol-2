import jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import { getUserById } from '../db/users.js';
import { isUserBanned, BAN_CACHE_TTL } from '../db/ban.js';
import { redisConnection } from '../db/connection.js';
import type { JwtPayload } from '../types/JwtPayload.js';

export interface SocketUser {
  userId: string;
  username: string;
  avatar: string | null;
}

function readAuthCookie(socket: Socket): string | null {
  const cookieHeader = socket.handshake.headers.cookie ?? '';
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function isBanned(userId: string): Promise<boolean> {
  const cacheKey = `ban:${userId}`;
  if ((await redisConnection.get(cacheKey)) === '1') return true;
  const banned = !!(await isUserBanned(userId));
  if (banned) await redisConnection.setex(cacheKey, BAN_CACHE_TTL, '1');
  return banned;
}

export async function getSocketUser(
  socket: Socket
): Promise<SocketUser | null> {
  const JWT_SECRET = process.env.JWT_SECRET;
  const token = readAuthCookie(socket);
  if (!JWT_SECRET || !token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as JwtPayload;
    if (!decoded.userId) return null;

    const user = await getUserById(decoded.userId);
    if (!user) return null;
    if (await isBanned(decoded.userId)) return null;

    return {
      userId: decoded.userId,
      username: user.username ?? decoded.username ?? 'Unknown',
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${decoded.userId}/${user.avatar}.png`
        : null,
    };
  } catch {
    return null;
  }
}
