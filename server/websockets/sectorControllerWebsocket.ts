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
    try {
      const user = JSON.parse(
        Array.isArray(socket.handshake.query.user)
          ? socket.handshake.query.user[0]
          : socket.handshake.query.user || '{}'
      );

      if (!user.userId) {
        socket.disconnect(true);
        return;
      }

      // Get user roles
      let userRoles: Array<{
        id: number;
        name: string;
        color: string;
        icon: string;
        priority: number;
      }> = [];
      try {
        userRoles = (await getUserRoles(user.userId)).map((role) => ({
          id: role.id,
          name: role.name,
          color: role.color ?? '#000000',
          icon: role.icon ?? '',
          priority: role.priority ?? 0,
        }));
      } catch (error) {
        console.error('Error fetching user roles:', error);
      }

      if (isAdmin(user.userId)) {
        userRoles.unshift({
          id: -1,
          name: 'Developer',
          color: '#3B82F6',
          icon: 'Braces',
          priority: 999999,
        });
      }

      socket.join(`sector-${user.userId}`);

      // Handle station selection
      socket.on('selectStation', async ({ station }) => {
        try {
          const sectorController: SectorController = {
            id: user.userId,
            username: user.username,
            avatar: user.avatar || null,
            station,
            joinedAt: Date.now(),
            roles: userRoles,
          };

          await addSectorController(user.userId, sectorController);


          socket.emit('stationSelected', { station });
        } catch (error) {
          console.error('Error selecting station:', error);
          socket.emit('error', { message: 'Failed to select station' });
        }
      });

      // Handle station deselection
      socket.on('deselectStation', async () => {
        try {
          await removeSectorController(user.userId);


          socket.emit('stationDeselected');
        } catch (error) {
          console.error('Error deselecting station:', error);
        }
      });

      socket.on('disconnect', async () => {
        await removeSectorController(user.userId);
      });
    } catch (error) {
      console.error('Error in sector controller websocket connection:', error);
      socket.disconnect(true);
    }
  });

  return io;
}
