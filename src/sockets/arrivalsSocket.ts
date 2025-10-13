import io from 'socket.io-client';
import type { Flight } from '../types/flight';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

export function createArrivalsSocket(
    sessionId: string,
    accessId: string,
    onArrivalUpdated: (flight: Flight) => void,
    onArrivalError?: (error: { action: string; flightId?: string | number; error: string }) => void,
    onInitialExternalArrivals?: (flights: Flight[]) => void
) {
    const socket = io(SOCKET_URL, {
        withCredentials: true,
        path: '/sockets/arrivals',
        query: { sessionId, accessId },
        transports: ['websocket', 'polling'],
        upgrade: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 10000
    });

    socket.on('arrivalUpdated', onArrivalUpdated);
    
    socket.on('initialExternalArrivals', (flights: Flight[]) => {
        if (onInitialExternalArrivals) {
            onInitialExternalArrivals(flights);
        }
    });
    
    if (onArrivalError) {
        socket.on('arrivalError', onArrivalError);
    }

    return {
        socket,
        updateArrival: (flightId: string | number, updates: Partial<Flight>) => {
            socket.emit('updateArrival', { flightId, updates });
        }
    };
}