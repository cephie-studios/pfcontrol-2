import { Server as SocketServer } from 'socket.io';
import { addFlight, updateFlight, deleteFlight } from '../db/flights.js';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { updateSession, getAllSessions, getSessionById } from '../db/sessions.js';
import { getArrivalsIO } from './arrivalsWebsocket.js';
import { handleFlightStatusChange } from '../services/logbookStatusHandler.js';
import flightsPool from '../db/connections/flightsConnection.js';

let io;
const updateTimers = new Map();

export function setupFlightsWebsocket(httpServer) {
    io = new SocketServer(httpServer, {
        path: '/sockets/flights',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:9901', 'https://control.pfconnect.online', 'https://test.pfconnect.online'],
            credentials: true
        }
    });

    io.on('connection', async (socket) => {
        const sessionId = socket.handshake.query.sessionId;
        const accessId = socket.handshake.query.accessId;

        if (!sessionId) {
            socket.disconnect(true);
            return;
        }

        let role = 'pilot';
        if (accessId) {
            const valid = await validateSessionAccess(sessionId, accessId);
            if (!valid) {
                socket.disconnect(true);
                return;
            }
            role = 'controller';
        }
        socket.data.role = role;

        socket.join(sessionId);

        socket.on('updateFlight', async ({ flightId, updates }) => {
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'update', flightId, error: 'Not authorized' });
                return;
            }
            try {
                if (updates.hasOwnProperty('hidden')) {
                    return;
                }

                if (updates.callsign && updates.callsign.length > 16) {
                    socket.emit('flightError', { action: 'update', flightId, error: 'Callsign too long' });
                    return;
                }

                if (updates.stand && updates.stand.length > 8) {
                    socket.emit('flightError', { action: 'update', flightId, error: 'Stand too long' });
                    return;
                }

                if (updates.clearance !== undefined) {
                    if (typeof updates.clearance === 'string') {
                        updates.clearance = updates.clearance.toLowerCase() === 'true';
                    }
                }

                const updatedFlight = await updateFlight(sessionId, flightId, updates);
                if (updatedFlight) {
                    io.to(sessionId).emit('flightUpdated', updatedFlight);

                    await broadcastToArrivalSessions(updatedFlight);

                    if (updates.status && updatedFlight.callsign) {
                        const session = await getSessionById(sessionId);
                        const controllerAirport = session?.airport_icao || null;
                        await handleFlightStatusChange(updatedFlight.callsign, updates.status, controllerAirport);
                    }
                } else {
                    socket.emit('flightError', { action: 'update', flightId, error: 'Flight not found' });
                }

                const timerKey = `${sessionId}-${flightId}`;
                if (updateTimers.has(timerKey)) {
                    clearTimeout(updateTimers.get(timerKey));
                }
                updateTimers.set(timerKey, setTimeout(async () => {
                    try {
                        await updateFlight(sessionId, flightId, updates);
                        updateTimers.delete(timerKey);
                    } catch (error) {
                    }
                }, 1000));

            } catch (error) {
                socket.emit('flightError', { action: 'update', flightId, error: 'Failed to update flight' });
            }
        });

        socket.on('addFlight', async (flightData) => {
            try {
                const enhancedFlightData = {
                    ...flightData,
                    user_id: socket.handshake.auth?.userId,
                    ip_address: socket.handshake.address
                };

                const flight = await addFlight(sessionId, enhancedFlightData);

                socket.emit('flightAdded', flight);

                const { acars_token, user_id, ip_address, ...sanitizedFlight } = flight;
                socket.to(sessionId).emit('flightAdded', sanitizedFlight);

                await broadcastToArrivalSessions(sanitizedFlight);
            } catch (error) {
                socket.emit('flightError', { action: 'add', error: 'Failed to add flight' });
            }
        });

        socket.on('deleteFlight', async (flightId) => {
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'delete', flightId, error: 'Not authorized' });
                return;
            }
            try {
                await deleteFlight(sessionId, flightId);
                io.to(sessionId).emit('flightDeleted', { flightId });
            } catch (error) {
                socket.emit('flightError', { action: 'delete', flightId, error: 'Failed to delete flight' });
            }
        });

        socket.on('updateSession', async (updates) => {
            if (socket.data.role !== 'controller') {
                socket.emit('sessionError', { error: 'Not authorized' });
                return;
            }
            try {
                const updatedSession = await updateSession(sessionId, updates);
                if (updatedSession) {
                    io.to(sessionId).emit('sessionUpdated', {
                        activeRunway: updatedSession.active_runway,
                    });
                } else {
                    socket.emit('sessionError', { error: 'Session not found or update failed' });
                }
            } catch (error) {
                socket.emit('sessionError', { error: 'Failed to update session' });
            }
        });

        socket.on('issuePDC', async ({ flightId, pdcText, targetPilotUserId }) => {
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'issuePDC', flightId, error: 'Not authorized' });
                return;
            }
            try {
                if (!flightId) {
                    socket.emit('flightError', { action: 'issuePDC', error: 'Missing flightId' });
                    return;
                }
                const updates = {
                    pdc_remarks: pdcText
                };

                const updatedFlight = await updateFlight(sessionId, flightId, updates);
                if (updatedFlight) {
                    io.to(sessionId).emit('flightUpdated', updatedFlight);
                    io.to(sessionId).emit('pdcIssued', { flightId, pdcText, updatedFlight });

                    await broadcastToArrivalSessions(updatedFlight);
                } else {
                    socket.emit('flightError', { action: 'issuePDC', flightId, error: 'Flight not found' });
                }
            } catch (error) {
                socket.emit('flightError', { action: 'issuePDC', flightId, error: 'Failed to issue PDC' });
            }
        });

        socket.on('requestPDC', ({ flightId, callsign, note }) => {
            try {
                io.to(sessionId).emit('pdcRequest', {
                    flightId,
                    callsign: callsign ?? null,
                    note: note ?? null,
                    requestedBy: socket.handshake.auth?.userId ?? socket.handshake.query?.username ?? null,
                    ts: new Date().toISOString()
                });
            } catch (err) {
                socket.emit('flightError', { action: 'requestPDC', flightId, error: 'Failed to request PDC' });
            }
        });

        socket.on('contactMe', async ({ flightId, message }) => {
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'contactMe', flightId, error: 'Not authorized' });
                return;
            }
            try {
                const allSessions = await getAllSessions();
                let targetSessionId = sessionId;

                for (const session of allSessions) {
                    try {
                        const tableName = `flights_${session.session_id}`;
                        const result = await flightsPool.query(
                            `SELECT session_id FROM ${tableName} WHERE id = $1`,
                            [flightId]
                        );
                        if (result.rows.length > 0) {
                            targetSessionId = session.session_id;
                            break;
                        }
                    } catch (err) {
                        continue;
                    }
                }

                io.to(targetSessionId).emit('contactMe', {
                    flightId,
                    message: message || 'CONTACT CONTROLLER ON FREQUENCY',
                    ts: new Date().toISOString()
                });
            } catch (err) {
                socket.emit('flightError', { action: 'contactMe', flightId, error: 'Failed to send contact message' });
            }
        });

        socket.on('disconnect', () => {});
    });

    return io;
}

async function broadcastToArrivalSessions(flight) {
    try {
        if (!flight.arrival) return;

        const allSessions = await getAllSessions();
        const arrivalSessions = allSessions.filter(session =>
            session.is_pfatc &&
            session.airport_icao === flight.arrival?.toUpperCase()
        );

        const arrivalsIO = getArrivalsIO();
        if (arrivalsIO) {
            for (const session of arrivalSessions) {
                arrivalsIO.to(session.session_id).emit('arrivalUpdated', flight);
            }
        }
    } catch (error) {
    }
}

export function getFlightsIO() {
    return io;
}

export function broadcastFlightEvent(sessionId, event, data) {
    if (io) {
        io.to(sessionId).emit(event, data);
    }
}
