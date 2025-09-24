import type { MetarResponse, MetarData } from '../../types/metar';

export async function fetchMetar(icao: string): Promise<MetarData | null> {
    try {
        const response = await fetch(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`);
        
        if (!response.ok) {
            console.error('Network response was not ok:', response.statusText);
            return null;
        }

        const text = await response.text();
        if (!text) {
            console.error('Empty response from METAR API');
            return null;
        }

        let data: MetarResponse;
        try {
            data = JSON.parse(text);
        } catch (jsonError) {
            console.error('Error parsing METAR JSON:', jsonError);
            return null;
        }

        if (data && data.length > 0) {
            return data[0];
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching METAR:', error);
        return null;
    }
}