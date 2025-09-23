import type { Airport } from '../../types/airports';
import type { Aircraft } from '../../types/aircraft';

async function fetchData<T>(endpoint: string): Promise<T[]> {
    try {
        const response = await fetch(
            `${import.meta.env.VITE_SERVER_URL}/api/data/${endpoint}`
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        return [];
    }
}

export function fetchAirports(): Promise<Airport[]> {
    return fetchData<Airport>('airports');
}

export function fetchAircrafts(): Promise<Aircraft[]> {
    return fetchData<Aircraft>('aircrafts');
}

export function fetchRunways(icao: string): Promise<string[]> {
    return fetchData<string>(`airports/${icao}/runways`);
}