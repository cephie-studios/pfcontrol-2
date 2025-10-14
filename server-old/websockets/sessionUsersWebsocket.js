import { Server as SocketServer } from 'socket.io';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { getSessionById, updateSession } from '../db/sessions.js';
import { getUserRoles } from '../db/roles.js';
import { isAdmin } from '../middleware/isAdmin.js';
import { validateSessionId, validateAccessId } from '../utils/validation.js';

const activeUsers = new Map();
const sessionATISConfigs = new Map();
const atisTimers = new Map();
const fieldEditingStates = new Map();

export function setupSessionUsersWebsocket(httpServer) {
    const io = new SocketServer(httpServer, {
        path: '/sockets/session-users',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:9901', 'https://control.pfconnect.online', 'https://test.pfconnect.online'],
            credentials: true
        }
    });

    const scheduleATISGeneration = (sessionId, config) => {
        if (atisTimers.has(sessionId)) {
            clearInterval(atisTimers.get(sessionId));
        }

        const timer = setInterval(async () => {
            try {
                await generateAutoATIS(sessionId, config, io);
            } catch (error) {
                console.error('Error auto-generating ATIS:', error);
            }
        }, 30 * 60 * 1000);

        atisTimers.set(sessionId, timer);
    };

    const broadcastFieldEditingStates = (sessionId) => {
        const sessionEditingStates = fieldEditingStates.get(sessionId);
        if (sessionEditingStates) {
            const editingArray = Array.from(sessionEditingStates.values());
            io.to(sessionId).emit('fieldEditingUpdate', editingArray);
        }
    };

    const addFieldEditingState = (sessionId, user, flightId, fieldName) => {
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

    const removeFieldEditingState = (sessionId, userId, flightId, fieldName) => {
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
            const sessionId = validateSessionId(socket.handshake.query.sessionId);
            const accessId = validateAccessId(socket.handshake.query.accessId);
            const user = JSON.parse(socket.handshake.query.user);

            socket.data.sessionId = sessionId;

            const valid = await validateSessionAccess(sessionId, accessId);
            if (!valid) {
                socket.disconnect(true);
                return;
            }

        if (!activeUsers.has(sessionId)) {
            activeUsers.set(sessionId, []);
        }
        const users = activeUsers.get(sessionId);

        // Fetch user roles
        let userRoles = [];
        try {
            userRoles = await getUserRoles(user.userId);
        } catch (error) {
            console.error('Error fetching user roles:', error);
        }

        // Add Developer pseudo-role for admins (highest priority)
        if (isAdmin(user.userId)) {
            userRoles.unshift({
                id: -1,
                name: 'Developer',
                color: '#3B82F6',
                icon: 'Braces',
                priority: 999999
            });
        }

        const sessionUser = {
            id: user.userId,
            username: user.username,
            avatar: user.avatar || null,
            joinedAt: Date.now(),
            position: socket.handshake.query.position || 'POSITION',
            roles: userRoles
        };
        const existingUserIndex = users.findIndex(u => u.id === sessionUser.id);
        if (existingUserIndex === -1) {
            users.push(sessionUser);
        } else {
            users[existingUserIndex] = sessionUser;
        }

        socket.join(sessionId);
        socket.join(`user-${user.userId}`);

        io.to(sessionId).emit('sessionUsersUpdate', users);

        try {
            const session = await getSessionById(sessionId);
            if (session?.atis) {
                socket.emit('atisUpdate', JSON.parse(session.atis));
            }
        } catch (error) {
            console.error('Error sending ATIS data:', error);
        }

        socket.on('atisGenerated', async (atisData) => {
            try {
                await updateSession(sessionId, { atis: atisData.atis });

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

        socket.on('positionChange', ({ position }) => {
            const users = activeUsers.get(sessionId);
            if (users) {
                const userIndex = users.findIndex(u => u.id === user.userId);
                if (userIndex !== -1) {
                    users[userIndex].position = position;
                    io.to(sessionId).emit('sessionUsersUpdate', users);
                }
            }
        });

        socket.on('disconnect', () => {
            const users = activeUsers.get(sessionId);
            if (users) {
                const index = users.findIndex(u => u.id === user.userId);
                if (index !== -1) {
                    users.splice(index, 1);
                }
                if (users.length === 0) {
                    activeUsers.delete(sessionId);
                    if (atisTimers.has(sessionId)) {
                        clearInterval(atisTimers.get(sessionId));
                        atisTimers.delete(sessionId);
                    }
                    sessionATISConfigs.delete(sessionId);
                } else {
                    io.to(sessionId).emit('sessionUsersUpdate', users);
                }
            }

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
            console.error('Invalid session or access ID:', error.message);
            socket.disconnect(true);
        }
    });

    io.sendMentionToUser = (userId, mention) => {
        io.to(`user-${userId}`).emit('chatMention', mention);
    };

    io.activeUsers = activeUsers;

    return io;
}

export function getActiveUsers() {
    return activeUsers;
}

async function generateAutoATIS(sessionId, config, io) {
    try {
        const session = await getSessionById(sessionId);
        if (!session?.atis) return;

        const currentAtis = JSON.parse(session.atis);
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

        const data = await response.json();

        if (data.status !== 'success') {
            throw new Error(data.message || 'Failed to generate ATIS');
        }

        const generatedAtis = data.data.text;
        if (!generatedAtis) {
            throw new Error('No ATIS data in response');
        }

        const atisData = {
            letter: nextIdent,
            text: generatedAtis,
            timestamp: new Date().toISOString(),
        };

        await updateSession(sessionId, { atis: atisData });

        io.to(sessionId).emit('atisUpdate', {
            atis: atisData,
            updatedBy: 'System',
            isAutoGenerated: true
        });
    } catch (error) {
        console.error('Error in auto ATIS generation:', error);
    }
}