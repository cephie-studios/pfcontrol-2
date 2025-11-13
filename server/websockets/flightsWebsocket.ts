import { Server as SocketIOServer, Socket } from 'socket.io';
import { addFlight, updateFlight, deleteFlight, type AddFlightData, type ClientFlight } from '../db/flights.js';
import { validateSessionAccess } from '../middleware/sessionAccess.js';
import { updateSession, getAllSessions } from '../db/sessions.js';
import { getArrivalsIO } from './arrivalsWebsocket.js';
import { flightsDb, mainDb } from '../db/connection.js';
import { validateSessionId, validateAccessId, validateFlightId } from '../utils/validation.js';
import { sanitizeCallsign, sanitizeString, sanitizeSquawk, sanitizeFlightLevel, sanitizeRunway } from '../utils/sanitization.js';
import type { Server as HTTPServer } from 'http';
import type { FlightsDatabase } from '../db/types/connection/FlightsDatabase.js';
import { incrementStat } from '../utils/statisticsCache.js';
import { logFlightAction } from '../db/flightLogs.js';
import { isEventController } from '../middleware/flightAccess.js';
import { broadcastFlightUpdate } from './overviewWebsocket.js';

interface FlightUpdateData {
    flightId: string | number;
    updates: Record<string, unknown>;
}

interface PDCData {
    flightId: string | number;
    pdcText: string;
    targetPilotUserId?: string;
}

interface PDCRequestData {
    flightId?: string | number;
    callsign?: string;
    note?: string;
}

interface ContactMeData {
    flightId: string | number;
    message?: string;
    station?: string;
    position?: string;
}

interface SessionUpdateData {
    activeRunway?: string;
}

let io: SocketIOServer;

export function setupFlightsWebsocket(httpServer: HTTPServer): SocketIOServer {
    io = new SocketIOServer(httpServer, {
        path: '/sockets/flights',
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:9901', 'https://control.pfconnect.online', 'https://test.pfconnect.online'],
            credentials: true
        },
        pingTimeout: 10000,
        pingInterval: 5000,
        upgradeTimeout: 3000,
        allowUpgrades: true
    });

    io.on('connection', async (socket: Socket) => {
        const sessionId = socket.handshake.query.sessionId as string;
        const accessId = socket.handshake.query.accessId as string;
        const userId = socket.handshake.query.userId as string;
        const isEventControllerFlag = socket.handshake.query.isEventController === 'true';

        try {
            const validSessionId = validateSessionId(sessionId);
            socket.data.sessionId = validSessionId;

            let role: 'pilot' | 'controller' = 'pilot';

            if (isEventControllerFlag && userId) {
                const hasEventControllerRole = await isEventController(userId);
                if (hasEventControllerRole) {
                    const session = await mainDb
                        .selectFrom('sessions')
                        .select(['is_pfatc'])
                        .where('session_id', '=', validSessionId)
                        .executeTakeFirst();

                    if (session?.is_pfatc) {
                        role = 'controller';
                        socket.data.isEventController = true;
                    } else {
                        console.error('Event controller attempted to connect to non-PFATC session:', validSessionId);
                        socket.disconnect(true);
                        return;
                    }
                } else {
                    console.error('User claimed to be event controller but lacks role:', userId);
                    socket.disconnect(true);
                    return;
                }
            }
            else if (accessId) {
                const validAccessId = validateAccessId(accessId);
                const valid = await validateSessionAccess(validSessionId, validAccessId);
                if (!valid) {
                    socket.disconnect(true);
                    return;
                }
                role = 'controller';
                socket.data.isEventController = false;
            }

            socket.data.role = role;
            socket.join(validSessionId);
        } catch (error) {
            console.error('Invalid session or access ID:', (error as Error).message);
            socket.disconnect(true);
            return;
        }

        socket.on('addFlight', async (flightData: Partial<FlightsDatabase[string]>) => {
            const sessionId = socket.data.sessionId;
            try {
                const enhancedFlightData = {
                    ...flightData,
                    user_id: userId,
                    ip_address: socket.handshake.address
                };

                const flight = await addFlight(sessionId, enhancedFlightData as AddFlightData);

                socket.emit('flightAdded', flight);

                const { acars_token, user_id, ip_address, ...sanitizedFlight } = flight;
                socket.to(sessionId).emit('flightAdded', sanitizedFlight);

                await broadcastToArrivalSessions(sanitizedFlight);

                // Log the add action
                await logFlightAction({
                    userId: userId || 'unknown',
                    username: socket.handshake.query.username as string || 'unknown',
                    sessionId,
                    action: 'add',
                    flightId: flight.id,
                    newData: sanitizedFlight,
                    ipAddress: socket.handshake.address
                });
            } catch {
                socket.emit('flightError', { action: 'add', error: 'Failed to add flight' });
            }
        });

        socket.on('updateFlight', async ({ flightId, updates }: FlightUpdateData) => {
            const sessionId = socket.data.sessionId;
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'update', flightId, error: 'Not authorized' });
                return;
            }

            try {
                validateFlightId(flightId);
                if (Object.prototype.hasOwnProperty.call(updates, 'hidden')) {
                    return;
                }

                socket.emit('flightUpdateAck', { flightId, updates });

                if (updates.callsign && typeof updates.callsign === 'string') updates.callsign = sanitizeCallsign(updates.callsign);
                if (updates.remark && typeof updates.remark === 'string') updates.remark = sanitizeString(updates.remark, 500);
                if (updates.squawk && typeof updates.squawk === 'string') updates.squawk = sanitizeSquawk(updates.squawk);
                if (updates.clearedFL && typeof updates.clearedFL === 'string') updates.clearedFL = sanitizeFlightLevel(updates.clearedFL);
                if (updates.cruisingFL && typeof updates.cruisingFL === 'string') updates.cruisingFL = sanitizeFlightLevel(updates.cruisingFL);
                if (updates.runway && typeof updates.runway === 'string') updates.runway = sanitizeRunway(updates.runway);
                if (updates.stand && typeof updates.stand === 'string') updates.stand = sanitizeString(updates.stand, 8);
                if (updates.gate && typeof updates.gate === 'string') updates.gate = sanitizeString(updates.gate, 8);
                if (updates.sid && typeof updates.sid === 'string') updates.sid = sanitizeString(updates.sid, 16);
                if (updates.star && typeof updates.star === 'string') updates.star = sanitizeString(updates.star, 16);

                if (updates.clearance !== undefined) {
                    if (typeof updates.clearance === 'string') {
                        updates.clearance = updates.clearance.toLowerCase() === 'true';
                    }
                }

                if (socket.data.role === 'controller' && updates && Object.keys(updates).length > 0) {
                    if (userId) {
                        incrementStat(userId, 'total_flight_edits', 1, 'total_edit_actions');
                    }
                }

                const updatedFlight = await updateFlight(sessionId, flightId as string, updates);
                if (updatedFlight) {
                    io.to(sessionId).emit('flightUpdated', updatedFlight);
                    
                    broadcastFlightUpdate(sessionId, updatedFlight);
                    
                    await broadcastToArrivalSessions(updatedFlight);

                    const oldFlight = await flightsDb
                        .selectFrom(`flights_${sessionId}`)
                        .selectAll()
                        .where('id', '=', flightId as string)
                        .executeTakeFirst();
                    const { acars_token: _, user_id: __, ip_address: ___, ...oldSanitized } = oldFlight || {};
                    const {user_id: _____, ip_address: ______, ...newSanitized } = updatedFlight;

                    await logFlightAction({
                        userId: userId || 'unknown',
                        username: socket.handshake.query.username as string || 'unknown',
                        sessionId,
                        action: 'update',
                        flightId: flightId as string,
                        oldData: oldSanitized,
                        newData: newSanitized,
                        ipAddress: socket.handshake.address
                    });
                } else {
                    socket.emit('flightError', { action: 'update', flightId, error: 'Flight not found' });
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('Error updating flight:', error);
                socket.emit('flightError', { action: 'update', flightId, error: errorMessage || 'Failed to update flight' });
            }
        });

        socket.on('deleteFlight', async (flightId: string | number) => {
            const sessionId = socket.data.sessionId;
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'delete', flightId, error: 'Not authorized' });
                return;
            }
            try {
                // Fetch flight data before deletion for logging
                const flightToDelete = await flightsDb
                    .selectFrom(`flights_${sessionId}`)
                    .selectAll()
                    .where('id', '=', flightId as string)
                    .executeTakeFirst();
                const { acars_token, user_id, ip_address, ...sanitizedOldData } = flightToDelete || {};

                await deleteFlight(sessionId, flightId as string);
                io.to(sessionId).emit('flightDeleted', { flightId });

                // Log the delete action
                await logFlightAction({
                    userId: userId || 'unknown',
                    username: socket.handshake.query.username as string || 'unknown',
                    sessionId,
                    action: 'delete',
                    flightId: flightId as string,
                    oldData: sanitizedOldData,
                    ipAddress: socket.handshake.address
                });
            } catch {
                socket.emit('flightError', { action: 'delete', flightId, error: 'Failed to delete flight' });
            }
        });

        socket.on('updateSession', async (updates: SessionUpdateData) => {
            const sessionId = socket.data.sessionId;
            if (socket.data.role !== 'controller') {
                socket.emit('sessionError', { error: 'Not authorized' });
                return;
            }
            try {
                const dbUpdates: Record<string, unknown> = {};
                if (updates.activeRunway !== undefined) {
                    dbUpdates.active_runway = updates.activeRunway;
                }

                const updatedSession = await updateSession(sessionId, dbUpdates);
                if (updatedSession) {
                    io.to(sessionId).emit('sessionUpdated', {
                        activeRunway: updatedSession.active_runway,
                    });
                } else {
                    socket.emit('sessionError', { error: 'Session not found or update failed' });
                }
            } catch {
                socket.emit('sessionError', { error: 'Failed to update session' });
            }
        });

        socket.on('issuePDC', async ({ flightId, pdcText, targetPilotUserId }: PDCData) => {
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

                const updatedFlight = await updateFlight(sessionId, flightId as string, updates);
                if (updatedFlight) {
                    io.to(sessionId).emit('flightUpdated', updatedFlight);
                    io.to(sessionId).emit('pdcIssued', { flightId, pdcText: sanitizedPDC, updatedFlight });

                    await broadcastToArrivalSessions(updatedFlight);
                } else {
                    socket.emit('flightError', { action: 'issuePDC', flightId, error: 'Flight not found' });
                }
            } catch {
                socket.emit('flightError', { action: 'issuePDC', flightId, error: 'Failed to issue PDC' });
            }
        });

        socket.on('requestPDC', ({ flightId, callsign, note }: PDCRequestData) => {
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
                    requestedBy: (socket.handshake.auth)?.userId ?? socket.handshake.query?.username ?? null,
                    ts: new Date().toISOString()
                });
            } catch{
                socket.emit('flightError', { action: 'requestPDC', flightId, error: 'Failed to request PDC' });
            }
        });

        socket.on('contactMe', async ({ flightId, message, station, position }: ContactMeData) => {
            const sessionId = socket.data.sessionId;
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'contactMe', flightId, station, position, error: 'Not authorized' });
                return;
            }
            try {
                validateFlightId(flightId);
                const allSessions = await getAllSessions();
                let targetSessionId = sessionId;

                for (const session of allSessions) {
                    try {
                        const tableName = `flights_${session.session_id}`;
                        const result = await flightsDb
                            .selectFrom(tableName)
                            .select('session_id')
                            .where('id', '=', flightId as string)
                            .execute();
                        
                        if (result.length > 0) {
                            targetSessionId = session.session_id;
                            break;
                        }
                    } catch {
                        continue;
                    }
                }

                const sanitizedMessage = message ? sanitizeString(message, 200) : 'CONTACT CONTROLLER ON FREQUENCY';
                io.to(targetSessionId).emit('contactMe', {
                    flightId,
                    message: sanitizedMessage,
                    station: station ? sanitizeString(station, 50) : undefined,
                    position: position ? sanitizeString(position, 50) : undefined,
                    ts: new Date().toISOString()
                });
            } catch {
                socket.emit('flightError', { action: 'contactMe', flightId, error: 'Failed to send contact message' });
            }
        });

        socket.on('disconnect', () => {});
    });

    return io;
}

async function broadcastToArrivalSessions(flight: ClientFlight): Promise<void> {
    try {
        if (!flight.arrival) return;

        const allSessions = await getAllSessions();
        const arrivalSessions = allSessions.filter(session =>
            session.is_pfatc &&
            typeof flight.arrival === 'string' &&
            session.airport_icao === flight.arrival.toUpperCase()
        );

        const arrivalsIO = getArrivalsIO();
        if (arrivalsIO) {
            for (const session of arrivalSessions) {
                arrivalsIO.to(session.session_id).emit('arrivalUpdated', flight);
            }
        }
    } catch {
        // Silent error handling
    }
}

export function getFlightsIO(): SocketIOServer | undefined {
    return io;
}

export function broadcastFlightEvent(sessionId: string, event: string, data: unknown): void {
    if (io) {
        io.to(sessionId).emit(event, data);
    }
}