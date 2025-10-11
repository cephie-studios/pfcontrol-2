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
    onOverviewError?: (error: { error: string }) => void
) {
    const socket = io(SOCKET_URL, {
        withCredentials: true,
        path: '/sockets/overview',
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        timeout: 20000,
        transports: ['polling', 'websocket'], // Start with polling to get fresh sid
        forceNew: true, // Force new connection to get fresh session ID
        autoConnect: true
    });

    socket.on('connect', () => {
        console.log('[Overview Socket] Connected successfully');
    });

    socket.on('connect_error', (error) => {
        console.error('[Overview Socket] Connection error:', error.message);

        // If error is about session ID, force reconnect with new session
        if (error.message.includes('Session ID') || error.message.includes('session')) {
            console.log('[Overview Socket] Forcing reconnect with new session...');
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
        console.log('[Overview Socket] Disconnected:', reason);

        // If disconnected due to server, try to reconnect with fresh session
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

    return {
        socket,
        disconnect: () => {
            socket.disconnect();
        }
    };
}