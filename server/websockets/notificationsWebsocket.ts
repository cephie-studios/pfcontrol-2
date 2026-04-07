import { Server as SocketServer } from 'socket.io';
import type { Server } from 'http';

let notificationsIO: SocketServer | null = null;

export function setupNotificationsWebsocket(httpServer: Server) {
  const io = new SocketServer(httpServer, {
    path: '/sockets/notifications',
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:9901',
        'https://pfcontrol.com',
        'https://canary.pfcontrol.com',
      ],
      credentials: true,
    },
    perMessageDeflate: {
      threshold: 512,
    },
  });

  notificationsIO = io;

  io.on('connection', (socket) => {
    socket.join('notifications');

    socket.on('disconnect', () => {
      // socket.io handles cleanup
    });
  });

  process.on('SIGTERM', () => {
    io.close();
  });

  return io;
}

export function broadcastNotificationsUpdate() {
  if (notificationsIO) {
    notificationsIO.to('notifications').emit('notificationsUpdated');
  }
}
