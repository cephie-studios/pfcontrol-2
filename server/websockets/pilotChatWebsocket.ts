import { Server as SocketServer, type Socket } from 'socket.io';
import type { Server } from 'http';
import {
  BROADCAST_FLIGHT_ID,
  addPilotChatMessage,
  deletePilotChatMessage,
  getAcarsFlight,
  getAcarsFlights,
  getPilotChatMessages,
  getSessionFlight,
  reportPilotChatMessage,
} from '../db/pilotChat.js';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import {
  validateAccessId,
  validateFlightId,
  validateSessionId,
} from '../utils/validation.js';
import { sanitizeMessage, sanitizeString } from '../utils/sanitization.js';
import { createHandshakeRateLimiter } from './handshakeRateLimit.js';
import { getSocketUser } from './socketAuth.js';

const MAX_MESSAGE_LENGTH = 300;
const MIN_SEND_INTERVAL_MS = 1500;

type Ack = (response: { ok: boolean; error?: string }) => void;

const queryString = (value: unknown) =>
  typeof (Array.isArray(value) ? value[0] : value) === 'string'
    ? String(Array.isArray(value) ? value[0] : value)
    : '';

const sessionRoom = (sessionId: string) => `pilot-chat:${sessionId}`;
const flightRoom = (sessionId: string, flightId: string) =>
  `pilot-chat:${sessionId}:${flightId}`;
const pilotsRoom = (sessionId: string) => `pilot-chat:${sessionId}:pilots`;

export function setupPilotChatWebsocket(httpServer: Server) {
  const io = new SocketServer(httpServer, {
    path: '/sockets/pilot-chat',
    allowRequest: createHandshakeRateLimiter({ scope: 'pilot-chat' }),
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:9901',
        'https://pfcontrol.com',
        'https://canary.pfcontrol.com',
      ],
      credentials: true,
    },
  });

  const sendAtcInit = async (socket: Socket) => {
    const sessionId = socket.data.sessionId as string;
    const [flights, messages] = await Promise.all([
      getAcarsFlights(sessionId),
      getPilotChatMessages(sessionId),
    ]);
    socket.emit('init', { flights, messages });
  };

  io.on('connection', async (socket) => {
    try {
      const { query } = socket.handshake;
      const sessionId = validateSessionId(queryString(query.sessionId));
      const user = await getSocketUser(socket);
      socket.data.sessionId = sessionId;
      socket.data.user = user;

      const acarsToken = queryString(query.acarsToken);
      if (acarsToken) {
        const flightId = validateFlightId(queryString(query.flightId));
        const flight = await getAcarsFlight(sessionId, flightId, acarsToken);
        if (!flight) {
          socket.disconnect(true);
          return;
        }
        socket.data.role = 'pilot';
        socket.data.flightId = flight.id;
        socket.data.callsign = flight.callsign;
        socket.join([flightRoom(sessionId, flight.id), pilotsRoom(sessionId)]);
        socket.emit('init', {
          messages: await getPilotChatMessages(sessionId, flight.id, 100),
        });
      } else {
        const accessId = validateAccessId(queryString(query.accessId));
        if (!user || !(await validateSessionAccess(sessionId, accessId))) {
          socket.disconnect(true);
          return;
        }
        socket.data.role = 'atc';
        socket.data.station =
          sanitizeString(queryString(query.station), 32) || null;
        socket.join(sessionRoom(sessionId));
        await sendAtcInit(socket);
      }
    } catch {
      socket.disconnect(true);
      return;
    }

    let lastSentAt = 0;

    socket.on('refresh', async () => {
      if (socket.data.role !== 'atc') return;
      try {
        await sendAtcInit(socket);
      } catch {
        socket.emit('pilotChatError', { error: 'Failed to load messages' });
      }
    });

    socket.on(
      'send',
      async (payload: { message?: unknown; flightId?: unknown }, ack?: Ack) => {
        const reply: Ack = typeof ack === 'function' ? ack : () => {};
        const user = socket.data.user;
        if (!user) {
          reply({ ok: false, error: 'Sign in to send messages' });
          return;
        }
        const now = Date.now();
        if (now - lastSentAt < MIN_SEND_INTERVAL_MS) {
          reply({ ok: false, error: 'You are sending messages too fast' });
          return;
        }
        const text =
          typeof payload?.message === 'string'
            ? sanitizeMessage(payload.message, MAX_MESSAGE_LENGTH)
            : '';
        if (!text) {
          reply({ ok: false, error: 'Message is empty' });
          return;
        }

        try {
          const sessionId = socket.data.sessionId as string;
          const isPilot = socket.data.role === 'pilot';
          let flightId: string;
          let callsign: string | null;
          if (isPilot) {
            flightId = socket.data.flightId;
            callsign = socket.data.callsign;
          } else if (payload?.flightId === BROADCAST_FLIGHT_ID) {
            flightId = BROADCAST_FLIGHT_ID;
            callsign = null;
          } else {
            const flight = await getSessionFlight(
              sessionId,
              validateFlightId(payload?.flightId)
            );
            if (!flight) {
              reply({ ok: false, error: 'Flight not found' });
              return;
            }
            flightId = flight.id;
            callsign = flight.callsign;
          }

          lastSentAt = now;
          const result = await addPilotChatMessage({
            sessionId,
            flightId,
            sender: isPilot ? 'pilot' : 'atc',
            userId: user.userId,
            username: user.username,
            avatar: user.avatar,
            station: isPilot ? null : socket.data.station,
            callsign,
            message: text,
          });
          if (!result.ok) {
            reply({ ok: false, error: result.reason });
            return;
          }
          const targets =
            flightId === BROADCAST_FLIGHT_ID
              ? [sessionRoom(sessionId), pilotsRoom(sessionId)]
              : [sessionRoom(sessionId), flightRoom(sessionId, flightId)];
          io.to(targets).emit('message', result.message);
          reply({ ok: true });
        } catch {
          reply({ ok: false, error: 'Failed to send message' });
        }
      }
    );

    socket.on('delete', async (payload: { messageId?: unknown }, ack?: Ack) => {
      const reply: Ack = typeof ack === 'function' ? ack : () => {};
      const user = socket.data.user;
      const messageId = Number(payload?.messageId);
      if (!user || !Number.isInteger(messageId)) {
        reply({ ok: false, error: 'Cannot delete this message' });
        return;
      }
      try {
        const sessionId = socket.data.sessionId as string;
        const flightId = await deletePilotChatMessage({
          sessionId,
          messageId,
          userId: user.userId,
          sender: socket.data.role === 'pilot' ? 'pilot' : 'atc',
        });
        if (!flightId) {
          reply({ ok: false, error: 'Cannot delete this message' });
          return;
        }
        const targets =
          flightId === BROADCAST_FLIGHT_ID
            ? [sessionRoom(sessionId), pilotsRoom(sessionId)]
            : [sessionRoom(sessionId), flightRoom(sessionId, flightId)];
        io.to(targets).emit('messageDeleted', { id: messageId });
        reply({ ok: true });
      } catch {
        reply({ ok: false, error: 'Failed to delete message' });
      }
    });

    socket.on(
      'report',
      async (payload: { messageId?: unknown; reason?: unknown }, ack?: Ack) => {
        const reply: Ack = typeof ack === 'function' ? ack : () => {};
        const user = socket.data.user;
        const messageId = Number(payload?.messageId);
        const reason =
          typeof payload?.reason === 'string'
            ? sanitizeString(payload.reason, 200)
            : '';
        if (!user) {
          reply({ ok: false, error: 'Sign in to report messages' });
          return;
        }
        if (!Number.isInteger(messageId) || !reason) {
          reply({ ok: false, error: 'Add a reason for the report' });
          return;
        }
        const isPilot = socket.data.role === 'pilot';
        try {
          await reportPilotChatMessage({
            sessionId: socket.data.sessionId,
            messageId,
            reporter: user,
            reason,
            allowedSender: isPilot ? 'atc' : 'pilot',
            flightId: isPilot ? socket.data.flightId : undefined,
          });
          reply({ ok: true });
        } catch {
          reply({ ok: false, error: 'Could not report this message' });
        }
      }
    );
  });

  return io;
}
