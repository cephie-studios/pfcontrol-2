import { Server as SocketIOServer, Socket } from 'socket.io';
import { addFlight, updateFlight, deleteFlight, type AddFlightData, type ClientFlight } from '../db/flights';
import { validateSessionAccess } from '../middleware/sessionAccess';
import { updateSession, getAllSessions, getSessionById } from '../db/sessions';
import { getArrivalsIO } from './arrivalsWebsocket';
import { handleFlightStatusChange } from '../services/logbookStatusHandler';
import { flightsDb } from '../db/connection';
import { validateSessionId, validateAccessId, validateFlightId } from '../utils/validation';
import { sanitizeCallsign, sanitizeString, sanitizeSquawk, sanitizeFlightLevel, sanitizeRunway } from '../utils/sanitization';
import type { Server as HTTPServer } from 'http';
import type { FlightsDatabase } from '../db/types/connection/FlightsDatabase';

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
        }
    });

    io.on('connection', async (socket: Socket) => {
        const sessionId = socket.handshake.query.sessionId as string;
        const accessId = socket.handshake.query.accessId as string;

        try {
            const validSessionId = validateSessionId(sessionId);
            socket.data.sessionId = validSessionId;

            let role: 'pilot' | 'controller' = 'pilot';
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
            console.error('Invalid session or access ID:', (error as Error).message);
            socket.disconnect(true);
            return;
        }

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

                const updatedFlight = await updateFlight(sessionId, flightId as string, updates);
                if (updatedFlight) {
                    io.to(sessionId).emit('flightUpdated', updatedFlight);

                    await broadcastToArrivalSessions(updatedFlight);

                    if (updates.status && typeof updates.status === 'string' && updatedFlight.callsign) {
                        const session = await getSessionById(sessionId);
                        const controllerAirport = session?.airport_icao || null;
                        await handleFlightStatusChange(updatedFlight.callsign, updates.status, controllerAirport);
                    }
                } else {
                    socket.emit('flightError', { action: 'update', flightId, error: 'Flight not found' });
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('Error updating flight:', error);
                socket.emit('flightError', { action: 'update', flightId, error: errorMessage || 'Failed to update flight' });
            }
        });

        socket.on('addFlight', async (flightData: Partial<FlightsDatabase[string]>) => {
            const sessionId = socket.data.sessionId;
            try {
                const enhancedFlightData = {
                    ...flightData,
                    user_id: (socket.handshake.auth)?.userId,
                    ip_address: socket.handshake.address
                };

                const flight = await addFlight(sessionId, enhancedFlightData as AddFlightData);

                socket.emit('flightAdded', flight);

                const { acars_token, user_id, ip_address, ...sanitizedFlight } = flight;
                socket.to(sessionId).emit('flightAdded', sanitizedFlight);

                await broadcastToArrivalSessions(sanitizedFlight);
            } catch {
                socket.emit('flightError', { action: 'add', error: 'Failed to add flight' });
            }
        });

        socket.on('deleteFlight', async (flightId: string | number) => {
            const sessionId = socket.data.sessionId;
            if (socket.data.role !== 'controller') {
                socket.emit('flightError', { action: 'delete', flightId, error: 'Not authorized' });
                return;
            }
            try {
                validateFlightId(flightId);
                await deleteFlight(sessionId, flightId as string);
                io.to(sessionId).emit('flightDeleted', { flightId });
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

        socket.on('contactMe', async ({ flightId, message }: ContactMeData) => {
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