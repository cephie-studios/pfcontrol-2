import { Server as SocketServer } from 'socket.io';
import { addFlight, updateFlight, deleteFlight } from '../db/flights.js';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { updateSession, getAllSessions } from '../db/sessions.js';
import { getArrivalsIO } from './arrivalsWebsocket.js';

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

        // Basic session check
        if (!sessionId) {
            socket.disconnect(true);
            return;
        }

        // Determine role:
        // - If an accessId is provided and validates -> controller (full privileges)
        // - If no accessId provided -> pilot (limited privileges: can listen & addFlight)
        // This avoids giving pilots controller access while still allowing them to receive events.
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
            // restrict updates from pilots (controllers only)
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'update', flightId, error: 'Not authorized' });
                return;
            }
            try {
                // Handle local hide/unhide - don't process these on server
                if (updates.hasOwnProperty('hidden')) {
                    return; // Ignore hidden field updates
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
                        console.error('Error saving flight update to DB:', error);
                    }
                }, 1000));

            } catch (error) {
                console.error('Error updating flight via websocket:', error);
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

                io.to(sessionId).emit('flightAdded', flight);

                await broadcastToArrivalSessions(flight);
            } catch (error) {
                console.error('Error adding flight via websocket:', error);
                socket.emit('flightError', { action: 'add', error: 'Failed to add flight' });
            }
        });

        socket.on('deleteFlight', async (flightId) => {
            // controllers only
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'delete', flightId, error: 'Not authorized' });
                return;
            }
            try {
                await deleteFlight(sessionId, flightId);
                io.to(sessionId).emit('flightDeleted', { flightId });
            } catch (error) {
                console.error('Error deleting flight via websocket:', error);
                socket.emit('flightError', { action: 'delete', flightId, error: 'Failed to delete flight' });
            }
        });

        socket.on('updateSession', async (updates) => {
            // controllers only
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
                console.error('Error updating session via websocket:', error);
                socket.emit('sessionError', { error: 'Failed to update session' });
            }
        });

        // NEW: controller issues a PDC for a flight -> persist & broadcast
        socket.on('issuePDC', async ({ flightId, pdcText, targetPilotUserId }) => {
            // controllers only
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'issuePDC', flightId, error: 'Not authorized' });
                return;
            }
            try {
                if (!flightId) {
                    socket.emit('flightError', { action: 'issuePDC', error: 'Missing flightId' });
                    return;
                }

                // Use pdc_remarks (frontend checks this). Avoid writing unknown columns.
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
                console.error('Error issuing PDC via websocket:', error);
                socket.emit('flightError', { action: 'issuePDC', flightId, error: 'Failed to issue PDC' });
            }
        });
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
        console.error('Error broadcasting to arrival sessions:', error);
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