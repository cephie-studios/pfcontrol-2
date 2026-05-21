import { apiFetch } from '../apiFetch.js';
import { clientApiUrl } from '../clientApiBase.js';
import type { MetarData } from '../../types/metar';

export async function fetchMetar(icao: string): Promise<MetarData | null> {
  try {
    const response = await apiFetch(clientApiUrl(`/api/metar/${icao}`), {
      credentials: 'include',
    });

    if (response.status === 404) {
      console.warn(
        `No METAR data available currently for airport: ${icao}. Refresh in a few seconds`
      );
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