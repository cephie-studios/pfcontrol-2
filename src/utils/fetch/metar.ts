import type { MetarData } from '../../types/metar';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export async function fetchMetar(icao: string): Promise<MetarData | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/metar/${icao}`, {
            credentials: 'include'
        });

        if (response.status === 204) {
            console.warn(`No METAR data available currently for airport: ${icao}. Refresh in a few seconds`);
            return null;
        }

        if (!response.ok) {
            console.error('Network response was not ok:', response.statusText);
            return null;
        }

        const data: MetarData = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching METAR:', error);
        return null;
    }
}