import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

export function createNotificationsSocket(onUpdate: () => void) {
  const socket = io(SOCKET_URL, {
    withCredentials: true,
    path: '/sockets/notifications',
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
  });

  socket.on('notificationsUpdated', onUpdate);

  return socket;
}
