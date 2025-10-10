import io from 'socket.io-client';
import type { Flight } from '../types/flight';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

export function createFlightsSocket(
    sessionId: string,
    accessId: string,
    onFlightUpdated: (flight: Flight) => void,
    onFlightAdded: (flight: Flight) => void,
    onFlightDeleted: (data: { flightId: string | number }) => void,
    onFlightError?: (error: { action: string; flightId?: string | number; error: string }) => void
) {
    const socket = io(SOCKET_URL, {
        withCredentials: true,
        path: '/sockets/flights',
        query: { sessionId, accessId },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 10000
    });

    socket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect') {
            socket.connect();
        }
    });

    socket.on('flightUpdated', onFlightUpdated);
    socket.on('flightAdded', onFlightAdded);
    socket.on('flightDeleted', onFlightDeleted);

    if (onFlightError) {
        socket.on('flightError', onFlightError);
    }

    return {
        socket,
        // Add a new flight via websocket
        addFlight: (flightData: Partial<Flight>) => {
            socket.emit('addFlight', flightData);
        },
        // Update a flight via websocket
        updateFlight: (flightId: string | number, updates: Partial<Flight>) => {
            socket.emit('updateFlight', { flightId, updates });
        },
        // Delete a flight via websocket
        deleteFlight: (flightId: string | number) => {
            socket.emit('deleteFlight', flightId);
        },
        // Update session metadata via websocket
        updateSession: (updates: Partial<{ activeRunway: string }>) => {
            socket.emit('updateSession', updates);
        }
    };
}