import { Server as SocketServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { Request } from 'express';
import {
  hashDeveloperApiKeySecret,
  isSupportedDeveloperApiKeySecretFormat,
} from '../developer/apiKeySecret.js';
import {
  findActiveDeveloperKeyBySecretHash,
  touchDeveloperApiKeyLastUsed,
  insertDeveloperApiUsage,
} from '../db/developer.js';
import { parseScopesFromKey } from '../middleware/developerExtApi.js';
import { getClientIp } from '../utils/getIpAddress.js';
import { hashIp } from '../utils/encryption.js';
import { createHandshakeRateLimiter } from './handshakeRateLimit.js';
import { getDeveloperNetworkSnapshot } from '../realtime/overview.js';
import { activeDeveloperNetworkSessions } from '../routes/ext/sessionsFlights.js';

const REQUIRED_SCOPE = 'sessions.network_overview';
const BROADCAST_INTERVAL_MS = 5000;
const MAX_CONNECTIONS_PER_KEY = 5;

interface DevSocketData {
  keyId: string;
  userId: string;
  scopeId: string;
}

let io: SocketServer;
const socketIdsByKey = new Map<string, Set<string>>();

function extractToken(handshake: {
  auth: Record<string, unknown>;
  query: Record<string, unknown>;
}): string | null {
  const authToken = handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim())
    return authToken.trim();
  const queryToken = handshake.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim())
    return queryToken.trim();
  return null;
}

export function setupExtNetworkFlightsWebsocket(httpServer: HTTPServer) {
  io = new SocketServer(httpServer, {
    path: '/sockets/ext/network-flights',
    allowRequest: createHandshakeRateLimiter({ scope: 'ext-network-flights' }),
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      if (socket.handshake.headers.origin) {
        return next(
          new Error('Browser connections are not allowed on this socket')
        );
      }

      const token = extractToken(socket.handshake);
      if (!token || !isSupportedDeveloperApiKeySecretFormat(token)) {
        return next(new Error('Invalid or missing API key'));
      }

      const row = await findActiveDeveloperKeyBySecretHash(
        hashDeveloperApiKeySecret(token)
      );
      if (!row) {
        return next(new Error('Invalid or missing API key'));
      }

      const scopes = parseScopesFromKey(row.key.scopes);
      if (!scopes.includes(REQUIRED_SCOPE)) {
        return next(new Error(`Missing required scope: ${REQUIRED_SCOPE}`));
      }

      const keyId = String(row.key.id);
      const existing = socketIdsByKey.get(keyId);
      if (existing && existing.size >= MAX_CONNECTIONS_PER_KEY) {
        return next(new Error('Too many concurrent connections for this key'));
      }

      socket.data = {
        keyId,
        userId: row.key.user_id,
        scopeId: REQUIRED_SCOPE,
      } satisfies DevSocketData;
      next();
    } catch (e) {
      console.error('[ext network-flights socket] auth error:', e);
      next(new Error('Internal error'));
    }
  });

  io.on('connection', async (socket) => {
    const data = socket.data as DevSocketData;
    const startedAt = Date.now();

    if (!socketIdsByKey.has(data.keyId)) {
      socketIdsByKey.set(data.keyId, new Set());
    }
    socketIdsByKey.get(data.keyId)!.add(socket.id);

    const ip = getClientIp(socket.request as unknown as Request);
    const validIp = ip && ip !== 'unknown' ? ip : null;
    void insertDeveloperApiUsage({
      keyId: data.keyId,
      userId: data.userId,
      scopeId: data.scopeId,
      method: 'WS',
      path: '/sockets/ext/network-flights',
      statusCode: 101,
      durationMs: 0,
      ipHash: validIp ? hashIp(validIp) : null,
      clientIp: validIp,
    });
    void touchDeveloperApiKeyLastUsed(data.keyId);

    try {
      const snapshot = await getDeveloperNetworkSnapshot();
      const flights = activeDeveloperNetworkSessions(snapshot).flatMap(
        (s) => s.flights
      );
      socket.emit('flights', flights);
    } catch (e) {
      console.error('[ext network-flights socket] initial push failed:', e);
    }

    socket.on('disconnect', () => {
      const set = socketIdsByKey.get(data.keyId);
      set?.delete(socket.id);
      if (set && set.size === 0) socketIdsByKey.delete(data.keyId);
      void insertDeveloperApiUsage({
        keyId: data.keyId,
        userId: data.userId,
        scopeId: data.scopeId,
        method: 'WS',
        path: '/sockets/ext/network-flights',
        statusCode: 0,
        durationMs: Date.now() - startedAt,
        ipHash: validIp ? hashIp(validIp) : null,
        clientIp: validIp,
      });
    });
  });

  const broadcastInterval = setInterval(async () => {
    if (io.engine.clientsCount === 0) return;
    try {
      const snapshot = await getDeveloperNetworkSnapshot();
      const flights = activeDeveloperNetworkSessions(snapshot).flatMap(
        (s) => s.flights
      );
      io.emit('flights', flights);
    } catch (e) {
      console.error('[ext network-flights socket] broadcast failed:', e);
    }
  }, BROADCAST_INTERVAL_MS);

  process.on('SIGTERM', () => {
    clearInterval(broadcastInterval);
    socketIdsByKey.clear();
  });

  return io;
}

export function getExtNetworkFlightsIO() {
  return io;
}
