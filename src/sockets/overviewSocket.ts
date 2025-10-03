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
        path: '/sockets/overview'
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