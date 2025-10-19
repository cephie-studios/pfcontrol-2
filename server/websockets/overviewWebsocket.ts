import { Server as SocketServer } from 'socket.io';
import { getAllSessions } from '../db/sessions.js';
import { getFlightsBySessionWithTime } from '../db/flights.js';
import { decrypt } from '../utils/encryption.js';
import { getUserById } from '../db/users.js';
import type { Server as HTTPServer } from 'http';

let io: SocketServer;
const activeOverviewClients = new Set<string>();

interface SessionUser {
    id?: string;
    username?: string;
    position?: string;
    roles?: Array<{
        id: number;
        name: string;
        color: string;
        icon: string;
        priority: number;
    }>;
}

export function setupOverviewWebsocket(httpServer: HTTPServer, sessionUsersIO: { activeUsers: Map<string, SessionUser[]> }) {
    io = new SocketServer(httpServer, {
        path: '/sockets/overview',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:9901', 'https://control.pfconnect.online', 'https://test.pfconnect.online'],
            credentials: true
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true
    });

    io.engine.on('connection_error', (err) => {
        console.error('[Overview Socket] Engine connection error:', err);
    });

    io.on('connection', async (socket) => {
        console.log('[Overview Socket] Client connected:', socket.id);
        activeOverviewClients.add(socket.id);

        try {
            const overviewData = await getOverviewData(sessionUsersIO);
            socket.emit('overviewData', overviewData);
            console.log('[Overview Socket] Sent initial data to:', socket.id);
        } catch (error) {
            console.error('[Overview Socket] Error sending initial data:', error);
            socket.emit('overviewError', { error: 'Failed to fetch overview data' });
        }

        socket.on('disconnect', (reason) => {
            console.log('[Overview Socket] Client disconnected:', socket.id, 'Reason:', reason);
            activeOverviewClients.delete(socket.id);
        });

        socket.on('error', (error) => {
            console.error('[Overview Socket] Socket error for', socket.id, ':', error);
        });
    });

    setInterval(async () => {
        if (activeOverviewClients.size > 0) {
            try {
                const overviewData = await getOverviewData(sessionUsersIO);
                io.emit('overviewData', overviewData);
            } catch (error) {
                console.error('Error broadcasting overview data:', error);
            }
        }
    }, 30000);

    return io;
}

export async function getOverviewData(sessionUsersIO: { activeUsers: Map<string, SessionUser[]> }) {
    try {
        const allSessions = await getAllSessions();
        const pfatcSessions = allSessions.filter(session => session.is_pfatc);
        const activeSessions = [];
        const activeUsers = sessionUsersIO?.activeUsers || new Map();

        for (const session of pfatcSessions) {
            const sessionUsers = activeUsers.get(session.session_id);
            const isActive = sessionUsers && sessionUsers.length > 0;

            if (isActive) {
                try {
                    const flights = await getFlightsBySessionWithTime(session.session_id, 2);

                    let atisData = null;
                    if (session.atis) {
                        try {
                            const encryptedAtis = JSON.parse(session.atis);
                            atisData = decrypt(encryptedAtis);
                        } catch (err) {
                            console.error('Error decrypting ATIS:', err);
                        }
                    }

                    const controllers = await Promise.all(sessionUsers.map(async (user) => {
                        let hasVatsimRating = false;
                        let isEventController = false;

                        if (user.id) {
                            try {
                                const userData = await getUserById(user.id);
                                hasVatsimRating = userData?.vatsim_rating_id && userData.vatsim_rating_id > 1;

                                if (user.roles) {
                                    isEventController = user.roles.some(role => role.name === 'Event Controller');
                                }
                            } catch (err) {
                                console.error('Error fetching user data for controller badges:', err);
                            }
                        }

                        return {
                            username: user.username || 'Unknown',
                            role: user.position || 'APP',
                            hasVatsimRating,
                            isEventController
                        };
                    }));

                    activeSessions.push({
                        sessionId: session.session_id,
                        airportIcao: session.airport_icao,
                        activeRunway: session.active_runway,
                        createdAt: session.created_at,
                        createdBy: session.created_by,
                        isPFATC: session.is_pfatc,
                        activeUsers: sessionUsers.length,
                        controllers: controllers,
                        atis: atisData,
                        flights: flights || [],
                        flightCount: flights ? flights.length : 0
                    });
                } catch (error) {
                    console.error(`Error fetching flights for session ${session.session_id}:`, error);

                    const controllers = sessionUsers.map(user => ({
                        username: user.username || 'Unknown',
                        role: user.position || 'APP',
                        hasVatsimRating: false,
                        isEventController: false
                    }));

                    activeSessions.push({
                        sessionId: session.session_id,
                        airportIcao: session.airport_icao,
                        activeRunway: session.active_runway,
                        createdAt: session.created_at,
                        createdBy: session.created_by,
                        isPFATC: session.is_pfatc,
                        activeUsers: sessionUsers.length,
                        controllers: controllers,
                        atis: null,
                        flights: [],
                        flightCount: 0
                    });
                }
            }
        }

        type ArrivalFlight = typeof activeSessions[number]['flights'][number] & {
            sessionId: string;
            departureAirport: string;
        };
        const arrivalsByAirport: { [key: string]: ArrivalFlight[] } = {};
        activeSessions.forEach(session => {
            session.flights.forEach(flight => {
                if (flight.arrival) {
                    const arrivalIcao = flight.arrival.toUpperCase();
                    if (!arrivalsByAirport[arrivalIcao]) {
                        arrivalsByAirport[arrivalIcao] = [];
                    }
                    arrivalsByAirport[arrivalIcao].push({
                        ...flight,
                        sessionId: session.sessionId,
                        departureAirport: session.airportIcao
                    });
                }
            });
        });

        return {
            activeSessions,
            totalActiveSessions: activeSessions.length,
            totalFlights: activeSessions.reduce((sum, session) => sum + session.flightCount, 0),
            arrivalsByAirport,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error in getOverviewData:', error);
        throw error;
    }
}

export function getOverviewIO() {
    return io;
}

export function hasOverviewClients() {
    return activeOverviewClients.size > 0;
}