import io, { type Socket } from 'socket.io-client';
import { getNodeSocketUrl } from './realtimeSocketUrl';

const listeners = new Set<() => void>();
let sharedSocket: Socket | null = null;

// Preserve socket across Vite HMR so reload does not close a connecting WebSocket.
if (import.meta.hot?.data?.notificationsSocket) {
  sharedSocket = import.meta.hot.data.notificationsSocket as Socket;
}
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.notificationsSocket = sharedSocket;
  });
}

function ensureSharedSocket(): Socket {
  if (sharedSocket) {
    return sharedSocket;
  }

  sharedSocket = io(getNodeSocketUrl(), {
    withCredentials: true,
    path: '/sockets/notifications',
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
  });

  sharedSocket.on('notificationsUpdated', () => {
    for (const listener of listeners) {
      listener();
    }
  });

  return sharedSocket;
}

export function subscribeNotifications(onUpdate: () => void): () => void {
  listeners.add(onUpdate);
  ensureSharedSocket();

  return () => {
    listeners.delete(onUpdate);
    if (listeners.size === 0 && sharedSocket) {
      sharedSocket.disconnect();
      sharedSocket = null;
    }
  };
}