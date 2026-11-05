import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

export const BROADCAST_FLIGHT_ID = '*';

export interface PilotChatMessage {
  id: number;
  flightId: string;
  sender: 'pilot' | 'atc';
  userId: string;
  username: string;
  avatar: string;
  station: string | null;
  callsign: string | null;
  message: string;
  sentAt: string;
}

export interface PilotChatFlight {
  id: string;
  callsign: string | null;
  departure: string | null;
  arrival: string | null;
}

type AckResponse = { ok: boolean; error?: string };

export function createPilotChatSocket(
  auth:
    | { sessionId: string; flightId: string; acarsToken: string }
    | { sessionId: string; accessId: string; station?: string }
) {
  const socket = io(SOCKET_URL, {
    withCredentials: true,
    path: '/sockets/pilot-chat',
    query: auth,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  const request = (event: string, payload: object) =>
    new Promise<void>((resolve, reject) => {
      if (!socket.connected) {
        reject(new Error('Chat is not connected'));
        return;
      }
      socket
        .timeout(8000)
        .emit(event, payload, (err: Error | null, res?: AckResponse) => {
          if (err) reject(new Error('The server did not respond'));
          else if (!res?.ok) reject(new Error(res?.error || 'Request failed'));
          else resolve();
        });
    });

  return {
    socket,
    send: (message: string, flightId?: string) =>
      request('send', { message, flightId }),
    remove: (messageId: number) => request('delete', { messageId }),
    report: (messageId: number, reason: string) =>
      request('report', { messageId, reason }),
    refresh: () => socket.emit('refresh'),
  };
}

export type PilotChatClient = ReturnType<typeof createPilotChatSocket>;
