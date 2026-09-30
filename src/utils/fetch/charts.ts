import { clientApiUrl } from '../clientApiBase';

export interface CelesbitPlate {
  kind: string;
  kindLabel: string;
  label: string;
  file: string;
}

export type CelesbitChartIndex = Record<string, CelesbitPlate[]>;

export async function fetchCelesbitCharts(): Promise<CelesbitChartIndex | null> {
  try {
    const response = await fetch(clientApiUrl('/api/charts'), {
      credentials: 'omit',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { airports?: CelesbitChartIndex };
    return data.airports ?? null;
  } catch (error) {
    console.error('Error fetching charts:', error);
    return null;
  }
}

export function celesbitPlateUrl(icao: string, file: string): string {
  return clientApiUrl(
    `/api/charts/plate/${encodeURIComponent(icao)}/${encodeURIComponent(file)}`
  );
}
