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

export interface ChartfoxStatus {
  configured: boolean;
  linked: boolean;
  name: string | null;
}

export interface ChartfoxChartSummary {
  id: string;
  parentId: string | null;
  name: string;
  code: string | null;
  type: number;
  typeKey: string;
  runways: string[];
  procedures: string[];
  viewUrl: string;
  georeferenced: boolean;
}

export interface ChartfoxChartDetail {
  id: string;
  airport: string;
  name: string;
  code: string | null;
  type: number;
  typeKey: string;
  viewUrl: string;
  source: {
    name: string | null;
    copyright: string | null;
    status: string | null;
  };
  requiresPreauth: boolean;
  updatedAt: string | null;
}

export type ChartfoxResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'unlinked' }
  | { status: 'error' };

async function chartfoxGet<T>(path: string): Promise<ChartfoxResult<T>> {
  try {
    const response = await fetch(clientApiUrl(`/api/charts/chartfox${path}`), {
      credentials: 'include',
    });
    if (response.status === 401) return { status: 'unlinked' };
    if (!response.ok) return { status: 'error' };
    return { status: 'ok', data: (await response.json()) as T };
  } catch (error) {
    console.error('Error fetching ChartFox data:', error);
    return { status: 'error' };
  }
}

export async function fetchChartfoxStatus(): Promise<ChartfoxStatus | null> {
  const result = await chartfoxGet<ChartfoxStatus>('/status');
  return result.status === 'ok' ? result.data : null;
}

export async function fetchChartfoxAirportCharts(
  icao: string
): Promise<ChartfoxResult<ChartfoxChartSummary[]>> {
  const result = await chartfoxGet<{ charts: ChartfoxChartSummary[] }>(
    `/airports/${encodeURIComponent(icao)}`
  );
  return result.status === 'ok'
    ? { status: 'ok', data: result.data.charts }
    : result;
}

export async function fetchChartfoxChart(
  id: string
): Promise<ChartfoxResult<ChartfoxChartDetail>> {
  const result = await chartfoxGet<{ chart: ChartfoxChartDetail }>(
    `/charts/${encodeURIComponent(id)}`
  );
  return result.status === 'ok'
    ? { status: 'ok', data: result.data.chart }
    : result;
}

export async function fetchChartfoxFile(
  id: string,
  signal?: AbortSignal
): Promise<ChartfoxResult<Blob>> {
  try {
    const response = await fetch(
      clientApiUrl(
        `/api/charts/chartfox/charts/${encodeURIComponent(id)}/file`
      ),
      { credentials: 'include', signal }
    );
    if (response.status === 401) return { status: 'unlinked' };
    if (!response.ok) return { status: 'error' };
    return { status: 'ok', data: await response.blob() };
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    console.error('Error fetching ChartFox chart file:', error);
    return { status: 'error' };
  }
}

export async function unlinkChartfox(): Promise<boolean> {
  try {
    const response = await fetch(clientApiUrl('/api/charts/chartfox'), {
      method: 'DELETE',
      credentials: 'include',
    });
    return response.ok;
  } catch (error) {
    console.error('Error unlinking ChartFox:', error);
    return false;
  }
}

export function chartfoxConnectUrl(mode: 'popup' | 'redirect'): string {
  return clientApiUrl(`/api/charts/chartfox/connect?mode=${mode}`);
}
