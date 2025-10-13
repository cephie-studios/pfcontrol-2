import type { Flight, TelemetryPoint } from '../../types/publicFlight';

export const fetchFlightDetails = async (shareToken: string): Promise<Flight> => {
    const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/logbook/public/${shareToken}`
    );
    if (!res.ok) {
        throw new Error('Flight not found or link expired');
    }
    return res.json();
};

export const fetchTelemetry = async (shareToken: string): Promise<TelemetryPoint[]> => {
    const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/logbook/public/${shareToken}/telemetry`
    );
    if (!res.ok) {
        throw new Error('Failed to load telemetry');
    }
    return res.json();
};