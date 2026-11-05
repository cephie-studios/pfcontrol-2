import io from 'socket.io-client';
import type { Flight } from '../types/flight';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

function connectFlightsSocket(query: Record<string, string>) {
  const socket = io(SOCKET_URL, {
    withCredentials: true,
    path: '/sockets/flights',
    query,
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionAttempts: 10,
    timeout: 5000,
    forceNew: false,
  });

  // The server kicks sockets it rejects (bad session/access) right after they
  // connect; reconnecting instantly loops and exhausts the handshake rate limit.
  let kicks = 0;
  let connectedAt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  socket.on('connect', () => {
    connectedAt = Date.now();
  });
  socket.on('disconnect', (reason) => {
    if (reason !== 'io server disconnect') return;
    if (Date.now() - connectedAt > 10_000) kicks = 0;
    kicks += 1;
    if (kicks > 5) return;
    retryTimer = setTimeout(
      () => socket.connect(),
      Math.min(30_000, 1000 * 2 ** (kicks - 1))
    );
  });
  const disconnect = socket.disconnect.bind(socket);
  socket.disconnect = () => {
    clearTimeout(retryTimer);
    return disconnect();
  };

  return socket;
}

export function createFlightsSocket(
  sessionId: string,
  accessId: string,
  userId: string,
  username: string,
  onFlightUpdated: (flight: Flight) => void,
  onFlightAdded: (flight: Flight) => void,
  onFlightDeleted: (data: { flightId: string | number }) => void,
  onFlightError?: (error: {
    action: string;
    flightId?: string | number;
    error: string;
  }) => void,
  isEventController?: boolean
) {
  const socket = connectFlightsSocket({
    sessionId,
    accessId,
    userId,
    username,
    ...(isEventController && { isEventController: 'true' }),
  });

  socket.on('flightUpdated', onFlightUpdated);
  socket.on('flightAdded', onFlightAdded);
  socket.on('flightDeleted', onFlightDeleted);

  if (onFlightError) {
    socket.on('flightError', onFlightError);
  }

  return {
    socket,
    // Add a new flight via websocket
    addFlight: (flightData: Partial<Flight>) => {
      socket.emit('addFlight', flightData);
    },
    // Update a flight via websocket
    updateFlight: (flightId: string | number, updates: Partial<Flight>) => {
      socket.emit('updateFlight', { flightId, updates });
    },
    // Delete a flight via websocket
    deleteFlight: (flightId: string | number) => {
      socket.emit('deleteFlight', flightId);
    },
    // Update session metadata via websocket
    updateSession: (
      updates: Partial<{ activeRunway: string; feedbackEnabled: boolean }>
    ) => {
      socket.emit('updateSession', updates);
    },
  };
}

export function createAcarsFlightSocket(
  sessionId: string,
  flightId: string,
  acarsToken: string
) {
  const socket = connectFlightsSocket({ sessionId, flightId, acarsToken });
  return {
    socket,
    requestPDC: (note: string) => {
      socket.emit('requestPDC', { flightId, note });
    },
  };
}
