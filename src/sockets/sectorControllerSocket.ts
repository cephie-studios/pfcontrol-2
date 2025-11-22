import { io, Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:9901';

export interface SectorControllerSocketCallbacks {
  onStationSelected?: (data: { station: string }) => void;
  onStationDeselected?: () => void;
  onError?: (error: { message: string }) => void;
}

export function createSectorControllerSocket(
  user: { userId: string; username: string; avatar?: string | null },
  callbacks: SectorControllerSocketCallbacks = {}
): {
  socket: Socket;
  selectStation: (station: string) => void;
  deselectStation: () => void;
} {
  const socket = io(SERVER_URL, {
    path: '/sockets/sector-controller',
    query: {
      user: JSON.stringify(user),
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('stationSelected', (data: { station: string }) => {
    callbacks.onStationSelected?.(data);
  });

  socket.on('stationDeselected', () => {
    callbacks.onStationDeselected?.();
  });

  socket.on('error', (error: { message: string }) => {
    console.error('[Sector Controller Socket] Error:', error);
    callbacks.onError?.(error);
  });

  const selectStation = (station: string) => {
    socket.emit('selectStation', { station });
  };

  const deselectStation = () => {
    socket.emit('deselectStation');
  };

  return { socket, selectStation, deselectStation };
}
