import { Server as SocketServer, Server } from 'socket.io';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { getSessionById, updateSession } from '../db/sessions.js';
import { getUserRoles } from '../db/roles.js';
import { isAdmin } from '../middleware/admin.js';
import { validateSessionId, validateAccessId } from '../utils/validation.js';
import type { Server as HttpServer } from 'http';
import { incrementStat } from '../utils/statisticsCache.js';
import {
  registerActiveSession,
  onSessionUsersChanged as syncActiveSessionRegistry,
  setSessionMetaFromRow,
} from '../realtime/activeSessions.js';
import {
  onSessionUsersChangedInvalidate,
  onAtisChanged,
} from '../realtime/invalidate.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { redisConnection } from '../db/connection.js';
import { createHandshakeRateLimiter } from './handshakeRateLimit.js';
import {
  decideExternalAcarsClaimRequest,
  getExternalAcarsClaim,
  getExternalAcarsClaimRequest,
  promoteDueExternalAcarsClaimRequest,
  type ExternalAcarsClaimRequest,
} from '../utils/externalAcarsClaims.js';

interface SessionUser {
  id: string;
  username: string;
  avatar: string | null;
  joinedAt: number;
  position: string;
  roles: Array<{
    id: number;
    name: string;
    color: string;
    icon: string;
    priority: number;
  }>;
}

export const getActiveUsersForSession = async (
  sessionId: string
): Promise<SessionUser[]> => {
  const users = await redisConnection.hgetall(`activeUsers:${sessionId}`);
  return Object.values(users).map(
    (userData) => JSON.parse(userData as string) as SessionUser
  );
};

const addUserToSession = async (
  sessionId: string,
  userId: string,
  userData: SessionUser
): Promise<void> => {
  await redisConnection.hset(
    `activeUsers:${sessionId}`,
    userId,
    JSON.stringify(userData)
  );
  const { keys } = await import('../realtime/keys.js');
  await redisConnection.sadd(keys.activeUsersIndex(), sessionId);
};

const updateUserInSession = async (
  sessionId: string,
  userId: string,
  updates: Partial<SessionUser>
): Promise<void> => {
  const users = await getActiveUsersForSession(sessionId);
  const userIndex = users.findIndex((u) => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex] = { ...users[userIndex], ...updates };
    await addUserToSession(sessionId, userId, users[userIndex]);
  }
};

const removeUserFromSession = async (
  sessionId: string,
  userId: string
): Promise<void> => {
  await redisConnection.hdel(`activeUsers:${sessionId}`, userId);
  const remainingUsers = await redisConnection.hlen(`activeUsers:${sessionId}`);
  if (remainingUsers === 0) {
    await redisConnection.del(`activeUsers:${sessionId}`);
  }
};

export interface SessionUsersServer extends Server {
  sendMentionToUser: (userId: string, mention: Mention) => void;
  getActiveUsersForSession: (sessionId: string) => Promise<
    Array<{
      id: string;
      username: string;
      avatar: string | null;
      joinedAt: number;
      position: string;
      roles: Array<{
        id: number;
        name: string;
        color: string;
        icon: string;
        priority: number;
      }>;
    }>
  >;
}

const sessionATISConfigs = new Map();
const atisTimers = new Map<string, NodeJS.Timeout>();
const fieldEditingStates = new Map();

// A user counts as inactive once this long passes with no mouse/keyboard
// activity; time stops accruing while inactive.
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
// How often accumulated active time is credited for connected users.
const ACTIVITY_ACCRUAL_INTERVAL_MS = 60 * 1000;

interface UserActivityEntry {
  lastActive: number;
  lastAccrual: number;
  totalActive: number;
}

const userActivity = new Map<string, UserActivityEntry>();

function accrueActiveTime(entry: UserActivityEntry, now: number) {
  const idleMs = now - entry.lastActive;
  if (idleMs <= IDLE_THRESHOLD_MS) {
    entry.totalActive += (now - entry.lastAccrual) / 60000;
  }
  entry.lastAccrual = now;
}

function flushActiveTime(userKey: string, entry: UserActivityEntry) {
  accrueActiveTime(entry, Date.now());
  if (entry.totalActive > 0) {
    const userId = userKey.split('-')[0];
    incrementStat(userId, 'total_time_controlling_minutes', entry.totalActive);
  }
}

const activityAccrualInterval = setInterval(() => {
  const now = Date.now();
  for (const entry of userActivity.values()) {
    accrueActiveTime(entry, now);
  }
}, ACTIVITY_ACCRUAL_INTERVAL_MS);

const cleanupOldSessions = async () => {
  try {
    const activeSessionIds = new Set<string>();
    const { keys: rtKeys } = await import('../realtime/keys.js');

    let sessionIds = await redisConnection.smembers(rtKeys.activeUsersIndex());
    if (sessionIds.length === 0) {
      const legacyKeys = await redisConnection.keys('activeUsers:*');
      sessionIds = legacyKeys.map((key) => key.replace('activeUsers:', ''));
    }

    for (const sessionId of sessionIds) {
      const userCount = await redisConnection.hlen(`activeUsers:${sessionId}`);
      if (userCount > 0) {
        activeSessionIds.add(sessionId);
      } else {
        await redisConnection.srem(rtKeys.activeUsersIndex(), sessionId);
      }
    }

    for (const [sessionId, timer] of atisTimers.entries()) {
      if (!activeSessionIds.has(sessionId)) {
        clearInterval(timer);
        atisTimers.delete(sessionId);
        sessionATISConfigs.delete(sessionId);
        console.log(`[Cleanup] Removed ATIS timer for session ${sessionId}`);
      }
    }

    for (const sessionId of fieldEditingStates.keys()) {
      if (!activeSessionIds.has(sessionId)) {
        fieldEditingStates.delete(sessionId);
        console.log(
          `[Cleanup] Removed field editing states for session ${sessionId}`
        );
      }
    }

    for (const [userKey, entry] of userActivity.entries()) {
      const sessionId = userKey.split('-')[1];
      if (sessionId && !activeSessionIds.has(sessionId)) {
        flushActiveTime(userKey, entry);
        userActivity.delete(userKey);
      }
    }
  } catch (error) {
    console.error('[Cleanup] Error cleaning up old sessions:', error);
  }
};

const sessionCleanupInterval = setInterval(cleanupOldSessions, 10 * 60 * 1000);

interface Mention {
  [key: string]: unknown;
}

interface ATISConfig {
  icao: string;
  landingRunways: string[];
  departingRunways: string[];
  selectedApproaches: string[];
  remarks?: string;
  userId?: string;
}

async function generateAutoATIS(
  sessionId: string,
  config: ATISConfig,
  io: SocketServer
): Promise<void> {
  try {
    const session = await getSessionById(sessionId);
    if (!session?.atis) return;

    const storedAtis =
      typeof session.atis === 'string'
        ? JSON.parse(session.atis)
        : session.atis;
    const currentAtis = decrypt(storedAtis);
    const currentLetter = currentAtis.letter || 'A';
    const identOptions = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const currentIndex = identOptions.indexOf(currentLetter);
    const nextIndex = (currentIndex + 1) % identOptions.length;
    const nextIdent = identOptions[nextIndex];

    const formatApproaches = () => {
      if (!config.selectedApproaches || config.selectedApproaches.length === 0)
        return '';

      const primaryRunway =
        config.landingRunways.length > 0
          ? config.landingRunways[0]
          : config.departingRunways.length > 0
            ? config.departingRunways[0]
            : '';

      if (config.selectedApproaches.length === 1) {
        return `EXPECT ${config.selectedApproaches[0]} APPROACH RUNWAY ${primaryRunway}`;
      }

      if (config.selectedApproaches.length === 2) {
        return `EXPECT SIMULTANEOUS ${config.selectedApproaches.join(' AND ')} APPROACH RUNWAY ${primaryRunway}`;
      }

      const lastApproach =
        config.selectedApproaches[config.selectedApproaches.length - 1];
      const otherApproaches = config.selectedApproaches.slice(0, -1);
      return `EXPECT SIMULTANEOUS ${otherApproaches.join(', ')} AND ${lastApproach} APPROACH RUNWAY ${primaryRunway}`;
    };

    const approachText = formatApproaches();
    const combinedRemarks = approachText
      ? config.remarks
        ? `${approachText}... ${config.remarks}`
        : approachText
      : config.remarks;

    const requestBody = {
      ident: nextIdent,
      icao: config.icao,
      remarks1: combinedRemarks,
      remarks2: {},
      landing_runways: config.landingRunways,
      departing_runways: config.departingRunways,
      'output-type': 'atis',
      override_runways: false,
    };

    const response = await fetch(
      `https://atisgenerator.com/api/v1/airports/${config.icao}/atis`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`External API responded with ${response.status}`);
    }

    const data = (await response.json()) as {
      status: string;
      message?: string;
      data?: { text: string };
    };

    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to generate ATIS');
    }

    const generatedAtis = data.data?.text;
    if (!generatedAtis) {
      throw new Error('No ATIS data in response');
    }

    const atisData = {
      letter: nextIdent,
      text: generatedAtis,
      timestamp: new Date().toISOString(),
    };

    const encryptedAtis = encrypt(atisData);
    await updateSession(sessionId, { atis: JSON.stringify(encryptedAtis) });

    io.to(sessionId).emit('atisUpdate', {
      atis: atisData,
      updatedBy: 'System',
      isAutoGenerated: true,
    });
  } catch (error) {
    console.error('Error in auto ATIS generation:', error);
  }
}

export type SessionClaimUpdate =
  | {
      status: 'pending';
      requestId: string;
      requesterName: string;
      decidesAt: string;
      remainingMs: number;
    }
  | {
      status: 'allowed' | 'declined';
      requestId: string;
      requesterName: string;
      by: string | null;
    }
  | { status: 'none' };

let sessionUsersIo: SocketServer | null = null;

function pendingClaimUpdate(
  request: ExternalAcarsClaimRequest
): SessionClaimUpdate {
  return {
    status: 'pending',
    requestId: request.requestId,
    requesterName: request.requesterName,
    decidesAt: request.decidesAt,
    remainingMs: Math.max(0, Date.parse(request.decidesAt) - Date.now()),
  };
}

export function emitSessionClaimUpdate(
  sessionId: string,
  update: SessionClaimUpdate
) {
  sessionUsersIo?.to(sessionId).emit('sessionClaimUpdate', update);
}

export function announceSessionClaimRequest(
  request: ExternalAcarsClaimRequest
) {
  emitSessionClaimUpdate(request.sessionId, pendingClaimUpdate(request));
  const delay = Math.max(0, Date.parse(request.decidesAt) - Date.now()) + 250;
  setTimeout(async () => {
    try {
      const claim =
        (await promoteDueExternalAcarsClaimRequest(request.sessionId)) ??
        (await getExternalAcarsClaim(request.sessionId));
      if (claim?.keyId === request.keyId) {
        emitSessionClaimUpdate(request.sessionId, {
          status: 'allowed',
          requestId: request.requestId,
          requesterName: request.requesterName,
          by: null,
        });
      }
    } catch (error) {
      console.error('[SessionClaims] Failed to promote claim request:', error);
    }
  }, delay);
}

export function setupSessionUsersWebsocket(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    path: '/sockets/session-users',
    allowRequest: createHandshakeRateLimiter({ scope: 'session-users' }),
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
      threshold: 1024,
    },
  }) as SessionUsersServer;
  sessionUsersIo = io;

  const scheduleATISGeneration = (sessionId: string, config: unknown) => {
    if (atisTimers.has(sessionId)) {
      clearInterval(atisTimers.get(sessionId));
    }

    const timer = setInterval(
      async () => {
        try {
          await generateAutoATIS(sessionId, config as ATISConfig, io);
        } catch (error) {
          console.error('Error auto-generating ATIS:', error);
        }
      },
      30 * 60 * 1000
    );

    atisTimers.set(sessionId, timer);
  };

  const broadcastFieldEditingStates = (sessionId: string) => {
    const sessionEditingStates = fieldEditingStates.get(sessionId);
    if (sessionEditingStates) {
      const editingArray = Array.from(sessionEditingStates.values());
      io.to(sessionId).emit('fieldEditingUpdate', editingArray);
    }
  };

  interface User {
    userId: string;
    username: string;
    avatar?: string | null;
  }

  const addFieldEditingState = (
    sessionId: string,
    user: User,
    flightId: string,
    fieldName: string
  ): void => {
    if (!fieldEditingStates.has(sessionId)) {
      fieldEditingStates.set(sessionId, new Map());
    }

    const sessionStates = fieldEditingStates.get(sessionId);
    const fieldKey = `${flightId}-${fieldName}`;

    sessionStates.set(fieldKey, {
      userId: user.userId,
      username: user.username,
      avatar: user.avatar,
      flightId,
      fieldName,
      timestamp: Date.now(),
    });

    broadcastFieldEditingStates(sessionId);
  };

  const removeFieldEditingState = (
    sessionId: string,
    userId: string,
    flightId: string,
    fieldName: string
  ): void => {
    const sessionStates = fieldEditingStates.get(sessionId);
    if (sessionStates) {
      const fieldKey = `${flightId}-${fieldName}`;
      const existingState = sessionStates.get(fieldKey);

      if (existingState && existingState.userId === userId) {
        sessionStates.delete(fieldKey);
        broadcastFieldEditingStates(sessionId);
      }
    }
  };

  io.on('connection', async (socket) => {
    try {
      const sessionId = validateSessionId(
        Array.isArray(socket.handshake.query.sessionId)
          ? socket.handshake.query.sessionId[0]
          : socket.handshake.query.sessionId
      );
      const accessId = validateAccessId(
        Array.isArray(socket.handshake.query.accessId)
          ? socket.handshake.query.accessId[0]
          : socket.handshake.query.accessId
      );
      const user = JSON.parse(
        Array.isArray(socket.handshake.query.user)
          ? socket.handshake.query.user[0]
          : socket.handshake.query.user || '{}'
      );

      socket.data.sessionId = sessionId;

      const valid = await validateSessionAccess(sessionId, accessId);
      if (!valid) {
        socket.disconnect(true);
        return;
      }

      let users = await getActiveUsersForSession(sessionId);

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

      const rawPosition = Array.isArray(socket.handshake.query.position)
        ? socket.handshake.query.position[0]
        : socket.handshake.query.position;
      const position =
        typeof rawPosition === 'string' && rawPosition.length > 0
          ? rawPosition
          : 'POSITION';

      const sessionUser = {
        id: user.userId,
        username: user.username,
        avatar: user.avatar || null,
        joinedAt: Date.now(),
        position,
        roles: userRoles,
      };

      await addUserToSession(sessionId, user.userId, sessionUser);

      users = await getActiveUsersForSession(sessionId);
      try {
        const session = await getSessionById(sessionId);
        if (session) await setSessionMetaFromRow(session);
      } catch {
        // ignore
      }
      await registerActiveSession(sessionId);
      void onSessionUsersChangedInvalidate(sessionId, users.length);

      socket.join(sessionId);
      socket.join(`user-${user.userId}`);
      io.to(sessionId).emit('sessionUsersUpdate', users);

      try {
        const session = await getSessionById(sessionId);
        if (session?.atis) {
          const encryptedAtis =
            typeof session.atis === 'string'
              ? JSON.parse(session.atis)
              : session.atis;
          const decryptedAtis = decrypt(encryptedAtis);
          socket.emit('atisUpdate', decryptedAtis);
        }
      } catch (error) {
        console.error('Error sending ATIS data:', error);
      }

      socket.on('atisGenerated', async (atisData) => {
        try {
          const encryptedAtis = encrypt(atisData.atis);
          await updateSession(sessionId, {
            atis: JSON.stringify(encryptedAtis),
          });

          sessionATISConfigs.set(sessionId, {
            icao: atisData.icao,
            landingRunways: atisData.landingRunways,
            departingRunways: atisData.departingRunways,
            selectedApproaches: atisData.selectedApproaches,
            remarks: atisData.remarks,
            userId: user.userId,
          });

          scheduleATISGeneration(sessionId, sessionATISConfigs.get(sessionId));

          io.to(sessionId).emit('atisUpdate', {
            atis: atisData.atis,
            updatedBy: user.username,
            isAutoGenerated: false,
          });
          void onAtisChanged(sessionId);
        } catch (error) {
          console.error('Error handling ATIS update:', error);
        }
      });

      try {
        const pendingClaim = await getExternalAcarsClaimRequest(sessionId);
        if (pendingClaim && Date.now() < Date.parse(pendingClaim.decidesAt)) {
          socket.emit('sessionClaimUpdate', pendingClaimUpdate(pendingClaim));
        }
      } catch (error) {
        console.error('Error sending pending session claim:', error);
      }

      socket.on('sessionClaimDecide', async (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        const decision = payload?.decision;
        if (decision !== 'allow' && decision !== 'decline') {
          reply({ ok: false, error: 'Invalid decision' });
          return;
        }
        try {
          const result = await decideExternalAcarsClaimRequest(
            sessionId,
            decision
          );
          if (!result.ok) {
            reply({
              ok: false,
              error:
                result.reason === 'expired'
                  ? 'The request already went through.'
                  : 'There is no pending request anymore.',
            });
            return;
          }
          console.log(
            `[SessionClaims] ${user.username} ${decision === 'allow' ? 'allowed' : 'declined'} claim on ${sessionId} (key ${result.request.keyId})`
          );
          emitSessionClaimUpdate(sessionId, {
            status: decision === 'allow' ? 'allowed' : 'declined',
            requestId: result.request.requestId,
            requesterName: result.request.requesterName,
            by: typeof user.username === 'string' ? user.username : null,
          });
          reply({ ok: true });
        } catch (error) {
          console.error('Error deciding session claim:', error);
          reply({ ok: false, error: 'Failed to update the request.' });
        }
      });

      socket.on('fieldEditingStart', ({ flightId, fieldName }) => {
        addFieldEditingState(sessionId, user, flightId, fieldName);
      });

      socket.on('fieldEditingStop', ({ flightId, fieldName }) => {
        removeFieldEditingState(sessionId, user.userId, flightId, fieldName);
      });

      socket.on('positionChange', async ({ position }) => {
        await updateUserInSession(sessionId, user.userId, { position });
        const updatedUsers = await getActiveUsersForSession(sessionId);
        io.to(sessionId).emit('sessionUsersUpdate', updatedUsers);
        void onSessionUsersChangedInvalidate(sessionId, updatedUsers.length);
      });

      const userKey = `${user.userId}-${sessionId}`;
      userActivity.set(userKey, {
        lastActive: Date.now(),
        lastAccrual: Date.now(),
        totalActive: 0,
      });

      socket.on('activityPing', () => {
        const entry = userActivity.get(userKey);
        if (entry) entry.lastActive = Date.now();
      });

      socket.on('disconnect', async () => {
        const entry = userActivity.get(userKey);
        if (entry) {
          flushActiveTime(userKey, entry);
          userActivity.delete(userKey);
        }

        await removeUserFromSession(sessionId, user.userId);
        const updatedUsers = await getActiveUsersForSession(sessionId);
        await syncActiveSessionRegistry(sessionId, updatedUsers.length);
        void onSessionUsersChangedInvalidate(sessionId, updatedUsers.length);
        io.to(sessionId).emit('sessionUsersUpdate', updatedUsers);

        const sessionStates = fieldEditingStates.get(sessionId);
        if (sessionStates) {
          for (const [fieldKey, state] of sessionStates.entries()) {
            if (state.userId === user.userId) {
              sessionStates.delete(fieldKey);
            }
          }
          broadcastFieldEditingStates(sessionId);
        }
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (!msg.startsWith('Invalid') && !msg.endsWith('is required')) {
        console.error('Error in websocket connection:', error);
      }
      socket.disconnect(true);
    }
  });

  io.sendMentionToUser = (userId: string, mention: unknown) => {
    io.to(`user-${userId}`).emit('chatMention', mention);
  };

  io.getActiveUsersForSession = getActiveUsersForSession;

  // Cleanup on shutdown
  process.on('SIGTERM', () => {
    console.log('[SessionUsers] Cleaning up timers...');
    clearInterval(sessionCleanupInterval);
    clearInterval(activityAccrualInterval);
    for (const timer of atisTimers.values()) {
      clearInterval(timer);
    }
    atisTimers.clear();
    sessionATISConfigs.clear();
    fieldEditingStates.clear();
    for (const [userKey, entry] of userActivity.entries()) {
      flushActiveTime(userKey, entry);
    }
    userActivity.clear();
  });

  return io;
}
