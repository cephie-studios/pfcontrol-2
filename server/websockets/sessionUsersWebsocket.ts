import { Server as SocketServer, Server } from 'socket.io';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { getSessionById, updateSession } from '../db/sessions.js';
import { getUserRoles } from '../db/roles.js';
import { isAdmin } from '../middleware/admin.js';
import { validateSessionId, validateAccessId } from '../utils/validation.js';
import type { Server as HttpServer } from 'http';
import { incrementStat } from '../utils/statisticsCache.js';
import { getOverviewIO } from './overviewWebsocket.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { redisConnection } from '../db/connection.js';

interface SessionUser {
  id: string;
  username: string;
  avatar: string | null;
  joinedAt: number;
  position: string;
  roles: Array<{ id: number; name: string; color: string; icon: string; priority: number }>;
}

export const getActiveUsersForSession = async (sessionId: string): Promise<SessionUser[]> => {
  const users = await redisConnection.hgetall(`activeUsers:${sessionId}`);
  return Object.values(users).map((userData) => JSON.parse(userData as string) as SessionUser);
};

const addUserToSession = async (sessionId: string, userId: string, userData: SessionUser): Promise<void> => {
  await redisConnection.hset(`activeUsers:${sessionId}`, userId, JSON.stringify(userData));
};

const updateUserInSession = async (sessionId: string, userId: string, updates: Partial<SessionUser>): Promise<void> => {
  const users = await getActiveUsersForSession(sessionId);
  const userIndex = users.findIndex((u) => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex] = { ...users[userIndex], ...updates };
    await addUserToSession(sessionId, userId, users[userIndex]);
  }
};

const removeUserFromSession = async (sessionId: string, userId: string): Promise<void> => {
  await redisConnection.hdel(`activeUsers:${sessionId}`, userId);
  const remainingUsers = await redisConnection.hlen(`activeUsers:${sessionId}`);
  if (remainingUsers === 0) {
    await redisConnection.del(`activeUsers:${sessionId}`);
  }
};

export interface SessionUsersServer extends Server {
  sendMentionToUser: (userId: string, mention: Mention) => void;
  getActiveUsersForSession: (sessionId: string) => Promise<Array<{ id: string; username: string; avatar: string | null; joinedAt: number; position: string; roles: Array<{ id: number; name: string; color: string; icon: string; priority: number }> }>>;
}

const sessionATISConfigs = new Map();
const atisTimers = new Map();
const fieldEditingStates = new Map();
const userActivity = new Map<string, { lastActive: number; sessionStart: number; totalActive: number }>();

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

async function generateAutoATIS(sessionId: string, config: ATISConfig, io: SocketServer): Promise<void> {
    try {
        const session = await getSessionById(sessionId);
        if (!session?.atis) return;

        const storedAtis = JSON.parse(session.atis);
        const currentAtis = decrypt(storedAtis);
        const currentLetter = currentAtis.letter || 'A';
        const identOptions = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const currentIndex = identOptions.indexOf(currentLetter);
        const nextIndex = (currentIndex + 1) % identOptions.length;
        const nextIdent = identOptions[nextIndex];

        const formatApproaches = () => {
            if (!config.selectedApproaches || config.selectedApproaches.length === 0) return '';

            const primaryRunway = config.landingRunways.length > 0
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

            const lastApproach = config.selectedApproaches[config.selectedApproaches.length - 1];
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
            override_runways: false
        };

        const response = await fetch(`https://atisgenerator.com/api/v1/airports/${config.icao}/atis`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`External API responded with ${response.status}`);
        }

        const data = await response.json() as {
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
            isAutoGenerated: true
        });
    } catch (error) {
        console.error('Error in auto ATIS generation:', error);
    }
}

export function setupSessionUsersWebsocket(httpServer: HttpServer) {
    const io = new SocketServer(httpServer, {
        path: '/sockets/session-users',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:9901', 'https://control.pfconnect.online', 'https://test.pfconnect.online'],
            credentials: true
        }
    }) as SessionUsersServer;

    const scheduleATISGeneration = (sessionId: string, config: unknown) => {
        if (atisTimers.has(sessionId)) {
            clearInterval(atisTimers.get(sessionId));
        }

        const timer = setInterval(async () => {
            try {
                await generateAutoATIS(sessionId, config as ATISConfig, io);
            } catch (error) {
                console.error('Error auto-generating ATIS:', error);
            }
        }, 30 * 60 * 1000);

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
            timestamp: Date.now()
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

    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        const maxAge = 30 * 1000;

        for (const [sessionId, sessionStates] of fieldEditingStates.entries()) {
            for (const [fieldKey, state] of sessionStates.entries()) {
                if (now - state.timestamp > maxAge) {
                    sessionStates.delete(fieldKey);
                }
            }

            if (sessionStates.size === 0) {
                fieldEditingStates.delete(sessionId);
            } else {
                broadcastFieldEditingStates(sessionId);
            }
        }
    }, 5000);

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

            let userRoles: Array<{ id: number; name: string; color: string; icon: string; priority: number }> = [];
            try {
                userRoles = (await getUserRoles(user.userId)).map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.color ?? '#000000',
                    icon: role.icon ?? '',
                    priority: role.priority ?? 0
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
                    priority: 999999
                });
            }

            const rawPosition = Array.isArray(socket.handshake.query.position)
                ? socket.handshake.query.position[0]
                : socket.handshake.query.position;
            const position = typeof rawPosition === 'string' && rawPosition.length > 0 ? rawPosition : 'POSITION';

            const sessionUser = {
                id: user.userId,
                username: user.username,
                avatar: user.avatar || null,
                joinedAt: Date.now(),
                position,
                roles: userRoles
            };

            await addUserToSession(sessionId, user.userId, sessionUser);

            users = await getActiveUsersForSession(sessionId);
            socket.join(sessionId);
            socket.join(`user-${user.userId}`);
            io.to(sessionId).emit('sessionUsersUpdate', users);

            try {
                const session = await getSessionById(sessionId);
                if (session?.atis) {
                    const encryptedAtis = JSON.parse(session.atis);
                    const decryptedAtis = decrypt(encryptedAtis);
                    socket.emit('atisUpdate', decryptedAtis);
                }
            } catch (error) {
                console.error('Error sending ATIS data:', error);
            }

            socket.on('atisGenerated', async (atisData) => {
                try {
                    const encryptedAtis = encrypt(atisData.atis);
                    await updateSession(sessionId, { atis: JSON.stringify(encryptedAtis) });

                    sessionATISConfigs.set(sessionId, {
                        icao: atisData.icao,
                        landingRunways: atisData.landingRunways,
                        departingRunways: atisData.departingRunways,
                        selectedApproaches: atisData.selectedApproaches,
                        remarks: atisData.remarks,
                        userId: user.userId
                    });

                    scheduleATISGeneration(sessionId, sessionATISConfigs.get(sessionId));

                    io.to(sessionId).emit('atisUpdate', {
                        atis: atisData.atis,
                        updatedBy: user.username,
                        isAutoGenerated: false
                    });
                } catch (error) {
                    console.error('Error handling ATIS update:', error);
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
                const overviewIO = getOverviewIO();
                if (overviewIO) {
                    setTimeout(async () => {
                        try {
                            const { getOverviewData } = await import('./overviewWebsocket.js');
                            const overviewData = await getOverviewData({ activeUsers: new Map([[sessionId, updatedUsers]]) } as unknown as SessionUsersServer);
                            overviewIO.emit('overviewData', overviewData);
                        } catch (error) {
                            console.error('Error broadcasting overview update:', error);
                        }
                    }, 100);
                }
            });

            const userKey = `${user.userId}-${sessionId}`;
            userActivity.set(userKey, { lastActive: Date.now(), sessionStart: Date.now(), totalActive: 0 });

            socket.on('activityPing', () => {
                const entry = userActivity.get(userKey);
                if (entry) entry.lastActive = Date.now();
            });

            socket.on('disconnect', async () => {
                const entry = userActivity.get(userKey);
                if (entry) {
                    const now = Date.now();
                    const remainingActiveTime = Math.max(0, (now - entry.lastActive) / 60000 - 0.1);
                    entry.totalActive += remainingActiveTime;
                    incrementStat(user.userId, 'total_time_controlling_minutes', entry.totalActive);
                    userActivity.delete(userKey);
                }

                await removeUserFromSession(sessionId, user.userId);
                const updatedUsers = await getActiveUsersForSession(sessionId);
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
            console.error('Error in websocket connection:', error);
        }
    });

    io.sendMentionToUser = (userId: string, mention: unknown) => {
        io.to(`user-${userId}`).emit('chatMention', mention);
    };

    io.getActiveUsersForSession = getActiveUsersForSession;

    return io;
}