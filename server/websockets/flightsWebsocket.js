import { Server as SocketServer } from 'socket.io';
import { addFlight, updateFlight, deleteFlight } from '../db/flights.js';
import { validateSessionAccess } from '../middleware/sessionAccess.js';

let io;
const updateTimers = new Map();

export function setupFlightsWebsocket(httpServer) {
    io = new SocketServer(httpServer, {
        path: '/sockets/flights',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:5000', 'https://control.pfconnect.online'],
            credentials: true
        }
    });

    io.on('connection', async (socket) => {
        const sessionId = socket.handshake.query.sessionId;
        const accessId = socket.handshake.query.accessId;

        const valid = await validateSessionAccess(sessionId, accessId);
        if (!valid) {
            socket.disconnect(true);
            return;
        }

        socket.join(sessionId);

        socket.on('addFlight', async (flightData) => {
            try {
                const flight = await addFlight(sessionId, flightData);
                io.to(sessionId).emit('flightAdded', flight);
            } catch (error) {
                console.error('Error adding flight via websocket:', error);
                socket.emit('flightError', { action: 'add', error: 'Failed to add flight' });
            }
        });

        socket.on('updateFlight', async ({ flightId, updates }) => {
            try {
                if (updates.clearance !== undefined) {
                    if (typeof updates.clearance === 'string') {
                        updates.clearance = updates.clearance.toLowerCase() === 'true';
                    }
                }

                const updatedFlight = await updateFlight(sessionId, flightId, updates);
                if (updatedFlight) {
                    io.to(sessionId).emit('flightUpdated', updatedFlight);
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

        socket.on('deleteFlight', async (flightId) => {
            try {
                await deleteFlight(sessionId, flightId);
                io.to(sessionId).emit('flightDeleted', { flightId });
            } catch (error) {
                console.error('Error deleting flight via websocket:', error);
                socket.emit('flightError', { action: 'delete', flightId, error: 'Failed to delete flight' });
            }
        });
    });

    return io;
}

export function getFlightsIO() {
    return io;
}

export function broadcastFlightEvent(sessionId, event, data) {
    if (io) {
        io.to(sessionId).emit(event, data);
    }
}