import io from 'socket.io-client';

export function createNotificationsSocket(onUpdate: () => void) {
  const base =
    import.meta.env.VITE_SERVER_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const socket = io(base, {
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