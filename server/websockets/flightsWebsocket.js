import { Server as SocketServer } from 'socket.io';
import { addFlight, updateFlight, deleteFlight } from '../db/flights.js';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { updateSession, getAllSessions, getSessionById } from '../db/sessions.js';
import { getArrivalsIO } from './arrivalsWebsocket.js';
import { handleFlightStatusChange } from '../services/logbookStatusHandler.js';
import flightsPool from '../db/connections/flightsConnection.js';
import { validateSessionId, validateAccessId, validateFlightId } from '../utils/validation.js';
import { sanitizeCallsign, sanitizeString, sanitizeSquawk, sanitizeFlightLevel, sanitizeRunway, sanitizeMessage } from '../utils/sanitization.js';

let io;

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

        try {
            const validSessionId = validateSessionId(sessionId);
            socket.data.sessionId = validSessionId;

            let role = 'pilot';
            if (accessId) {
                const validAccessId = validateAccessId(accessId);
                const valid = await validateSessionAccess(validSessionId, validAccessId);
                if (!valid) {
                    socket.disconnect(true);
                    return;
                }
                role = 'controller';
            }
            socket.data.role = role;

            socket.join(validSessionId);
        } catch (error) {
            console.error('Invalid session or access ID:', error.message);
            socket.disconnect(true);
            return;
        }

        socket.on('updateFlight', async ({ flightId, updates }) => {
            const sessionId = socket.data.sessionId;
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'update', flightId, error: 'Not authorized' });
                return;
            }
            try {
                validateFlightId(flightId);
                if (updates.hasOwnProperty('hidden')) {
                    return;
                }

                if (updates.callsign) updates.callsign = sanitizeCallsign(updates.callsign);
                if (updates.remark) updates.remark = sanitizeString(updates.remark, 500);
                if (updates.squawk) updates.squawk = sanitizeSquawk(updates.squawk);
                if (updates.clearedFL) updates.clearedFL = sanitizeFlightLevel(updates.clearedFL);
                if (updates.cruisingFL) updates.cruisingFL = sanitizeFlightLevel(updates.cruisingFL);
                if (updates.runway) updates.runway = sanitizeRunway(updates.runway);
                if (updates.stand) updates.stand = sanitizeString(updates.stand, 8);
                if (updates.gate) updates.gate = sanitizeString(updates.gate, 8);
                if (updates.sid) updates.sid = sanitizeString(updates.sid, 16);
                if (updates.star) updates.star = sanitizeString(updates.star, 16);

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

            } catch (error) {
                socket.emit('flightError', { action: 'update', flightId, error: 'Failed to update flight' });
            }
        });

        socket.on('addFlight', async (flightData) => {
            const sessionId = socket.data.sessionId;
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
            const sessionId = socket.data.sessionId;
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'delete', flightId, error: 'Not authorized' });
                return;
            }
            try {
                validateFlightId(flightId);
                await deleteFlight(sessionId, flightId);
                io.to(sessionId).emit('flightDeleted', { flightId });
            } catch (error) {
                socket.emit('flightError', { action: 'delete', flightId, error: 'Failed to delete flight' });
            }
        });

        socket.on('updateSession', async (updates) => {
            const sessionId = socket.data.sessionId;
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
            const sessionId = socket.data.sessionId;
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'issuePDC', flightId, error: 'Not authorized' });
                return;
            }
            try {
                if (!flightId) {
                    socket.emit('flightError', { action: 'issuePDC', error: 'Missing flightId' });
                    return;
                }
                validateFlightId(flightId);
                const sanitizedPDC = sanitizeString(pdcText, 1000);
                const updates = {
                    pdc_remarks: sanitizedPDC
                };

                const updatedFlight = await updateFlight(sessionId, flightId, updates);
                if (updatedFlight) {
                    io.to(sessionId).emit('flightUpdated', updatedFlight);
                    io.to(sessionId).emit('pdcIssued', { flightId, pdcText: sanitizedPDC, updatedFlight });

                    await broadcastToArrivalSessions(updatedFlight);
                } else {
                    socket.emit('flightError', { action: 'issuePDC', flightId, error: 'Flight not found' });
                }
            } catch (error) {
                socket.emit('flightError', { action: 'issuePDC', flightId, error: 'Failed to issue PDC' });
            }
        });

        socket.on('requestPDC', ({ flightId, callsign, note }) => {
            const sessionId = socket.data.sessionId;
            try {
                if (flightId) {
                    validateFlightId(flightId);
                }
                const sanitizedCallsign = callsign ? sanitizeCallsign(callsign) : null;
                const sanitizedNote = note ? sanitizeString(note, 200) : null;
                io.to(sessionId).emit('pdcRequest', {
                    flightId,
                    callsign: sanitizedCallsign,
                    note: sanitizedNote,
                    requestedBy: socket.handshake.auth?.userId ?? socket.handshake.query?.username ?? null,
                    ts: new Date().toISOString()
                });
            } catch (err) {
                socket.emit('flightError', { action: 'requestPDC', flightId, error: 'Failed to request PDC' });
            }
        });

        socket.on('contactMe', async ({ flightId, message }) => {
            const sessionId = socket.data.sessionId;
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'contactMe', flightId, error: 'Not authorized' });
                return;
            }
            try {
                validateFlightId(flightId);
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

                const sanitizedMessage = message ? sanitizeString(message, 200) : 'CONTACT CONTROLLER ON FREQUENCY';
                io.to(targetSessionId).emit('contactMe', {
                    flightId,
                    message: sanitizedMessage,
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
