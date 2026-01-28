import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { redisConnection } from '../db/connection.js';
import { getUserRoles } from '../db/roles.js';
import { isAdmin } from '../middleware/admin.js';
import { getOverviewIO } from './overviewWebsocket.js';
import type { SessionUsersServer } from './sessionUsersWebsocket.js';

interface SectorController {
  id: string;
  username: string;
  avatar: string | null;
  station: string;
  joinedAt: number;
  roles: Array<{
    id: number;
    name: string;
    color: string;
    icon: string;
    priority: number;
  }>;
}

// User roles cache with TTL
const userRolesCache = new Map<
  string,
  { roles: SectorController['roles']; timestamp: number }
>();
const ROLES_CACHE_TTL = 5 * 60 * 1000;

// Rate limiting per socket
const rateLimitMap = new Map<
  string,
  { count: number; resetTime: number }
>();
const RATE_LIMIT_WINDOW = 10000;
const RATE_LIMIT_MAX = 15;

// Redis key TTL for automatic cleanup
const REDIS_CONTROLLER_TTL = 24 * 60 * 60;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false;
  }

  userLimit.count++;
  return true;
}

async function getUserRolesWithCache(
  userId: string
): Promise<SectorController['roles']> {
  const now = Date.now();
  const cached = userRolesCache.get(userId);

  if (cached && now - cached.timestamp < ROLES_CACHE_TTL) {
    return cached.roles;
  }

  let roles: SectorController['roles'] = [];
  try {
    const dbRoles = await getUserRoles(userId);
    roles = dbRoles.map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color ?? '#000000',
      icon: role.icon ?? '',
      priority: role.priority ?? 0,
    }));

    if (isAdmin(userId)) {
      roles.unshift({
        id: -1,
        name: 'Developer',
        color: '#3B82F6',
        icon: 'Braces',
        priority: 999999,
      });
    }

    userRolesCache.set(userId, { roles, timestamp: now });
  } catch (error) {
    console.error('Error fetching user roles:', error);
  }

  return roles;
}

export function invalidateUserRolesCache(userId?: string): void {
  if (userId) {
    userRolesCache.delete(userId);
  } else {
    userRolesCache.clear();
  }
}

export const getActiveSectorControllers = async (): Promise<
  SectorController[]
> => {
  const controllers = await redisConnection.hgetall('activeSectorControllers');
  return Object.values(controllers).map(
    (controllerData) => JSON.parse(controllerData as string) as SectorController
  );
};

const addSectorController = async (
  userId: string,
  controllerData: SectorController
): Promise<void> => {
  await redisConnection.hset(
    'activeSectorControllers',
    userId,
    JSON.stringify(controllerData)
  );
  // Set TTL for auto-cleanup in case of ungraceful disconnect
  await redisConnection.expire('activeSectorControllers', REDIS_CONTROLLER_TTL);
};

const removeSectorController = async (userId: string): Promise<void> => {
  await redisConnection.hdel('activeSectorControllers', userId);
};

export function setupSectorControllerWebsocket(
  httpServer: HttpServer,
  sessionUsersIO: SessionUsersServer
) {
  const io = new SocketServer(httpServer, {
    path: '/sockets/sector-controller',
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:9901',
        'https://control.pfconnect.online',
        'https://canary.pfconnect.online',
      ],
      credentials: true,
    },
    perMessageDeflate: {
      threshold: 1024,
    },
  });

  io.on('connection', async (socket) => {
    let user: { userId?: string; username?: string; avatar?: string | null };

    try {
      // Parse and validate user data
      const userQuery = Array.isArray(socket.handshake.query.user)
        ? socket.handshake.query.user[0]
        : socket.handshake.query.user;

      if (!userQuery) {
        socket.disconnect(true);
        return;
      }

      try {
        user = JSON.parse(userQuery);
      } catch (parseError) {
        console.error('Invalid user data:', parseError);
        socket.disconnect(true);
        return;
      }

      if (!user.userId || !user.username) {
        socket.disconnect(true);
        return;
      }

      // Get user roles with caching
      const userRoles = await getUserRolesWithCache(user.userId);

      socket.join(`sector-${user.userId}`);

      // Handle station selection
      socket.on('selectStation', async ({ station }) => {
        if (!user.userId) return;

        if (!checkRateLimit(user.userId)) {
          socket.emit('error', { message: 'Too many requests. Please slow down.' });
          return;
        }

        if (!station || typeof station !== 'string' || station.length > 10) {
          socket.emit('error', { message: 'Invalid station format' });
          return;
        }

        try {
          const sectorController: SectorController = {
            id: user.userId,
            username: user.username!,
            avatar: user.avatar || null,
            station: station.trim().toUpperCase(),
            joinedAt: Date.now(),
            roles: userRoles,
          };

          await addSectorController(user.userId, sectorController);

          // Broadcast to all connected clients
          io.emit('controllerAdded', sectorController);

          socket.emit('stationSelected', { station: sectorController.station });
        } catch (error) {
          console.error('Error selecting station:', error);
          socket.emit('error', { message: 'Failed to select station' });
        }
      });

      // Handle station deselection
      socket.on('deselectStation', async () => {
        if (!user.userId) return;

        if (!checkRateLimit(user.userId)) {
          socket.emit('error', { message: 'Too many requests. Please slow down.' });
          return;
        }

        try {
          await removeSectorController(user.userId);

          // Broadcast to all connected clients
          io.emit('controllerRemoved', { id: user.userId });

          socket.emit('stationDeselected');
        } catch (error) {
          console.error('Error deselecting station:', error);
        }
      });

      socket.on('disconnect', async () => {
        if (!user.userId) return;

        await removeSectorController(user.userId);

        // Broadcast to all connected clients
        io.emit('controllerRemoved', { id: user.userId });

        rateLimitMap.delete(user.userId);
      });
    } catch (error) {
      console.error('Error in sector controller websocket connection:', error);
      socket.disconnect(true);
    }
  });

  // Periodic cleanup of expired cache entries
  const cacheCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [userId, data] of userRolesCache.entries()) {
      if (now - data.timestamp > ROLES_CACHE_TTL) {
        userRolesCache.delete(userId);
      }
    }
    for (const [userId, data] of rateLimitMap.entries()) {
      if (now > data.resetTime + 60000) {
        rateLimitMap.delete(userId);
      }
    }
  }, 60000);

  io.on('close', () => {
    clearInterval(cacheCleanupInterval);
    userRolesCache.clear();
    rateLimitMap.clear();
  });

  return io;
}
