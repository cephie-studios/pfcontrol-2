import { Server as SocketServer } from 'socket.io';
import { updateFlight, getFlightsBySessionWithTime } from '../db/flights.js';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { getSessionById, getAllSessions } from '../db/sessions.js';
import { getFlightsIO } from './flightsWebsocket.js';
import { handleFlightStatusChange } from '../services/logbookStatusHandler.js';
import { validateSessionId, validateAccessId, validateFlightId } from '../utils/validation.js';
import { sanitizeString, sanitizeSquawk, sanitizeFlightLevel } from '../utils/sanitization.js';

let io;
const updateTimers = new Map();

export function setupArrivalsWebsocket(httpServer) {
    io = new SocketServer(httpServer, {
        path: '/sockets/arrivals',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:9901', 'https://control.pfconnect.online', 'https://test.pfconnect.online'],
            credentials: true
        }
    });

    io.on('connection', async (socket) => {
        try {
            const sessionId = validateSessionId(socket.handshake.query.sessionId);
            const accessId = validateAccessId(socket.handshake.query.accessId);

            const valid = await validateSessionAccess(sessionId, accessId);
            if (!valid) {
                socket.disconnect(true);
                return;
            }

            const session = await getSessionById(sessionId);
            if (!session || !session.is_pfatc) {
                socket.disconnect(true);
                return;
            }

            socket.data.sessionId = sessionId;
            socket.data.session = session;

            socket.join(sessionId);

        try {
            const externalArrivals = await getExternalArrivals(session.airport_icao);
            socket.emit('initialExternalArrivals', externalArrivals);
        } catch (error) {
            console.error('Error fetching external arrivals:', error);
        }

        socket.on('updateArrival', async ({ flightId, updates }) => {
            const sessionId = socket.data.sessionId;
            const session = socket.data.session;
            try {
                validateFlightId(flightId);

                if (updates.status) {
                    console.log(`[ArrivalWS] Received update for ${flightId}:`, JSON.stringify(updates));
                }

                const sourceSessionId = await findFlightSourceSession(flightId, session.airport_icao);

                if (!sourceSessionId) {
                    socket.emit('arrivalError', { action: 'update', flightId, error: 'Flight not found in any session' });
                    return;
                }

                const allowedFields = ['clearedFL', 'status', 'star', 'remark', 'squawk', 'gate'];
                const filteredUpdates = {};

                for (const [key, value] of Object.entries(updates)) {
                    if (allowedFields.includes(key)) {
                        filteredUpdates[key] = value;
                    }
                }

                if (Object.keys(filteredUpdates).length === 0) {
                    socket.emit('arrivalError', { action: 'update', flightId, error: 'No valid fields to update' });
                    return;
                }

                if (filteredUpdates.clearedFL) filteredUpdates.clearedFL = sanitizeFlightLevel(filteredUpdates.clearedFL);
                if (filteredUpdates.star) filteredUpdates.star = sanitizeString(filteredUpdates.star, 16);
                if (filteredUpdates.remark) filteredUpdates.remark = sanitizeString(filteredUpdates.remark, 500);
                if (filteredUpdates.squawk) filteredUpdates.squawk = sanitizeSquawk(filteredUpdates.squawk);
                if (filteredUpdates.gate) filteredUpdates.gate = sanitizeString(filteredUpdates.gate, 8);

                const updatedFlight = await updateFlight(sourceSessionId, flightId, filteredUpdates);

                if (updatedFlight) {
                    // Handle logbook status changes
                    if (filteredUpdates.status && updatedFlight.callsign) {
                        console.log(`[ArrivalWS] Detected status change: ${updatedFlight.callsign} -> ${filteredUpdates.status}`);
                        // Get session's airport to determine origin vs destination
                        const controllerAirport = session?.airport_icao || null;
                        await handleFlightStatusChange(updatedFlight.callsign, filteredUpdates.status, controllerAirport);
                    }

                    const flightsIO = getFlightsIO();
                    if (flightsIO) {
                        flightsIO.to(sourceSessionId).emit('flightUpdated', updatedFlight);
                    }

                    io.to(sessionId).emit('arrivalUpdated', updatedFlight);

                    await broadcastToOtherArrivalSessions(updatedFlight, sessionId);
                } else {
                    socket.emit('arrivalError', { action: 'update', flightId, error: 'Flight not found' });
                }

            } catch (error) {
                console.error('Error updating arrival via websocket:', error);
                socket.emit('arrivalError', { action: 'update', flightId, error: 'Failed to update arrival' });
            }
        });
        } catch (error) {
            console.error('Invalid session or access ID:', error.message);
            socket.disconnect(true);
        }
    });

    return io;
}

async function findFlightSourceSession(flightId, arrivalAirport) {
    try {
        const allSessions = await getAllSessions();
        const pfatcSessions = allSessions.filter(session =>
            session.is_pfatc && session.airport_icao !== arrivalAirport
        );

        for (const session of pfatcSessions) {
            try {
                const flights = await getFlightsBySessionWithTime(session.session_id, 2);
                const flight = flights.find(f => f.id === flightId);
                if (flight) {
                    return session.session_id;
                }
            } catch (error) {
                console.error(`Error checking session ${session.session_id} for flight ${flightId}:`, error);
            }
        }
        return null;
    } catch (error) {
        console.error('Error finding flight source session:', error);
        return null;
    }
}

async function broadcastToOtherArrivalSessions(flight, excludeSessionId) {
    try {
        const allSessions = await getAllSessions();
        const arrivalSessions = allSessions.filter(session =>
            session.is_pfatc &&
            session.session_id !== excludeSessionId &&
            session.airport_icao === flight.arrival?.toUpperCase()
        );

        for (const session of arrivalSessions) {
            io.to(session.session_id).emit('arrivalUpdated', flight);
        }
    } catch (error) {
        console.error('Error broadcasting to other arrival sessions:', error);
    }
}

async function getExternalArrivals(airportIcao) {
    try {
        const allSessions = await getAllSessions();
        const pfatcSessions = allSessions.filter(session =>
            session.is_pfatc && session.airport_icao !== airportIcao
        );

        const externalArrivals = [];

        for (const session of pfatcSessions) {
            try {
                const flights = await getFlightsBySessionWithTime(session.session_id, 2);
                const arrivalsToThisAirport = flights.filter(flight =>
                    flight.arrival?.toUpperCase() === airportIcao.toUpperCase()
                );

                const enrichedFlights = arrivalsToThisAirport.map(flight => ({
                    ...flight,
                    sourceSessionId: session.session_id,
                    sourceAirport: session.airport_icao,
                    isExternal: true
                }));

                externalArrivals.push(...enrichedFlights);
            } catch (error) {
                console.error(`Error fetching flights for session ${session.session_id}:`, error);
            }
        }

        return externalArrivals;
    } catch (error) {
        console.error('Error fetching external arrivals:', error);
        return [];
    }
}

export function getArrivalsIO() {
    return io;
}

export function broadcastArrivalEvent(sessionId, event, data) {
    if (io) {
        io.to(sessionId).emit(event, data);
    }
}