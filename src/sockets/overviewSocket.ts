import io from 'socket.io-client';
import type { Flight } from '../types/flight';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

export interface OverviewSession {
    sessionId: string;
    airportIcao: string;
    activeRunway?: string;
    createdAt: string;
    createdBy: string;
    isPFATC: boolean;
    activeUsers: number;
    controllers?: Array<{
        username: string;
        role: string;
        avatar?: string | null;
        hasVatsimRating?: boolean;
        isEventController?: boolean;
    }>;
    atis?: {
        letter: string;
        text: string;
        timestamp: string;
    } | null;
    flights: Flight[];
    flightCount: number;
}

export interface OverviewData {
    activeSessions: OverviewSession[];
    totalActiveSessions: number;
    totalFlights: number;
    arrivalsByAirport: Record<string, Flight[]>;
    lastUpdated: string;
}

export function createOverviewSocket(
    onOverviewData: (data: OverviewData) => void,
    onOverviewError?: (error: { error: string }) => void,
    isEventController?: boolean,
    userId?: string,
    username?: string,
    onFlightUpdated?: (data: { sessionId: string; flight: Flight }) => void,
    onFlightUpdateAck?: (_data: { flightId: string | number; updates: Partial<Flight> }) => void,
    onFlightError?: (error: { action: string; flightId?: string | number; error: string }) => void
) {
    const socket = io(SOCKET_URL, {
        withCredentials: true,
        path: '/sockets/overview',
        query: {
            ...(isEventController && {
                isEventController: 'true',
                userId,
                username
            })
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        timeout: 20000,
        transports: ['websocket', 'polling'],
        upgrade: true,
        autoConnect: true
    });

    socket.on('connect_error', (error) => {
        console.error('[Overview Socket] Connection error:', error.message);

        if (error.message.includes('Session ID') || error.message.includes('session')) {
            socket.disconnect();
            setTimeout(() => {
                socket.connect();
            }, 1000);
        }

        if (onOverviewError) {
            onOverviewError({ error: error.message || 'Failed to connect to overview socket' });
        }
    });

    socket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect' || reason === 'transport close') {
            socket.connect();
        }
    });

    socket.on('error', (error) => {
        console.error('[Overview Socket] Socket error:', error);
        if (onOverviewError) {
            onOverviewError({ error: typeof error === 'string' ? error : 'Socket error occurred' });
        }
    });

    socket.on('overviewData', onOverviewData);

    if (onOverviewError) {
        socket.on('overviewError', onOverviewError);
    }

    if (isEventController && onFlightUpdated) {
        socket.on('flightUpdated', onFlightUpdated);
    }

    if (onFlightUpdateAck) {
        socket.on('flightUpdateAck', onFlightUpdateAck);
    }

    if (onFlightError) {
        socket.on('flightError', onFlightError);
    }

    return {
        socket,
        disconnect: () => {
            socket.disconnect();
        },
        updateFlight: (sessionId: string, flightId: string | number, updates: Partial<Flight>) => {
            socket.emit('updateFlight', { sessionId, flightId, updates });
        },
        sendContact: (sessionId: string, flightId: string | number, message: string, station: string, position: string) => {
            socket.emit('contactMe', { sessionId, flightId, message, station, position });
        }
    };
}