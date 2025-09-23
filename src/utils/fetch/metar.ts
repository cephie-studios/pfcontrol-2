import type { MetarResponse, MetarData } from '../../types/metar';

export async function fetchMetar(icao: string): Promise<MetarData | null> {
    try {
        const response = await fetch(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`);
        const data: MetarResponse = await response.json();
        
        if (data && data.length > 0) {
            return data[0];
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching METAR:', error);
        return null;
    }
}