import { Server as SocketServer } from 'socket.io';
import { getAllSessions } from '../db/sessions.js';
import { getFlightsBySessionWithTime } from '../db/flights.js';
import { decrypt } from '../utils/encryption.js';
import { getUserById } from '../db/users.js';
import type { Server as HTTPServer } from 'http';
import type { SessionUsersServer } from './sessionUsersWebsocket.js';

let io: SocketServer;
const activeOverviewClients = new Set<string>()

export function setupOverviewWebsocket(httpServer: HTTPServer, sessionUsersIO: SessionUsersServer) {
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
        activeOverviewClients.add(socket.id);

        try {
            const overviewData = await getOverviewData(sessionUsersIO);
            socket.emit('overviewData', overviewData);
        } catch (error) {
            console.error('[Overview Socket] Error sending initial data:', error);
            socket.emit('overviewError', { error: 'Failed to fetch overview data' });
        }

        socket.on('disconnect', () => {
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

export async function getOverviewData(sessionUsersIO: SessionUsersServer) { // Update parameter type
    try {
        // Import sector controller function
        const { getActiveSectorControllers } = await import('./sectorControllerWebsocket.js');
        const sectorControllers = await getActiveSectorControllers();

        const allSessions = await getAllSessions();
        const pfatcSessions = allSessions.filter(session => session.is_pfatc);
        const activeSessions = [];

        for (const session of pfatcSessions) {
            const sessionUsers = await sessionUsersIO.getActiveUsersForSession(session.session_id); // Use directly
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
                        let avatar = null;

                        if (user.id) {
                            try {
                                const userData = await getUserById(user.id);
                                hasVatsimRating = userData?.vatsim_rating_id && userData.vatsim_rating_id > 1;

                                if (userData?.avatar) {
                                    avatar = `https://cdn.discordapp.com/avatars/${user.id}/${userData.avatar}.png`;
                                }

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
                            avatar,
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

                    const controllers = await Promise.all(sessionUsers.map(async (user) => {
                        let avatar = null;

                        if (user.id) {
                            try {
                                const userData = await getUserById(user.id);
                                if (userData?.avatar) {
                                    avatar = `https://cdn.discordapp.com/avatars/${user.id}/${userData.avatar}.png`;
                                }
                            } catch {
                                // Ignore avatar fetch errors in fallback
                            }
                        }

                        return {
                            username: user.username || 'Unknown',
                            role: user.position || 'APP',
                            avatar,
                            hasVatsimRating: false,
                            isEventController: false
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
                        atis: null,
                        flights: [],
                        flightCount: 0
                    });
                }
            }
        }

        // Add sector controllers as separate "sessions"
        for (const sectorController of sectorControllers) {
            let hasVatsimRating = false;
            let isEventController = false;
            let avatar = sectorController.avatar;

            try {
                const userData = await getUserById(sectorController.id);
                hasVatsimRating = userData?.vatsim_rating_id && userData.vatsim_rating_id > 1;

                if (userData?.avatar && !avatar) {
                    avatar = `https://cdn.discordapp.com/avatars/${sectorController.id}/${userData.avatar}.png`;
                }

                if (sectorController.roles) {
                    isEventController = sectorController.roles.some(role => role.name === 'Event Controller');
                }
            } catch (err) {
                console.error('Error fetching user data for sector controller:', err);
            }

            const controllerData = {
                username: sectorController.username || 'Unknown',
                role: 'CTR',
                avatar,
                hasVatsimRating,
                isEventController
            };

            activeSessions.push({
                sessionId: `sector-${sectorController.id}`,
                airportIcao: sectorController.station,
                activeRunway: null,
                createdAt: new Date(sectorController.joinedAt).toISOString(),
                createdBy: sectorController.id,
                isPFATC: true,
                activeUsers: 1,
                controllers: [controllerData],
                atis: null,
                flights: [],
                flightCount: 0
            });
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