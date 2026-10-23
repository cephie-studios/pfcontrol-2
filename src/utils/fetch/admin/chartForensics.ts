import { apiError } from '../error.js';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || '';

export type ForensicsVerdict = 'match' | 'possible' | 'none';

export interface ForensicsMatch {
  userId: string;
  username: string;
  z: number;
  correlation: number;
  level: number;
}

export interface ForensicsAlignment {
  dx: number;
  dy: number;
  width: number;
  height: number;
  quality: number;
  scale?: number;
}

export interface ForensicsChartRef {
  icao: string;
  kind: string;
  name: string;
}

export type ForensicsIdentified =
  | { via: 'selected' }
  | {
      via: 'appearance' | 'text';
      wordsRead: number;
      tried: number;
      matched: string[];
      alternatives: ForensicsChartRef[];
    };

export type ForensicsResult =
  | { aligned: false; reason: string }
  | {
      aligned: true;
      plate: ForensicsChartRef & { version: string };
      identified: ForensicsIdentified;
      chart: { width: number; height: number };
      alignment: ForensicsAlignment;
      cells: number;
      noiseStd: number;
      verdict: ForensicsVerdict;
      matches: ForensicsMatch[];
      candidatesTested: number;
    };

export async function analyzeChartLeak(
  file: File,
  chart: { icao: string; kind: string } | null,
  extraUserIds: string[]
): Promise<ForensicsResult> {
  const query = new URLSearchParams({
    ...(chart ? { icao: chart.icao, kind: chart.kind } : {}),
    ...(extraUserIds.length ? { userIds: extraUserIds.join(',') } : {}),
  });
  const response = await fetch(
    `${API_BASE_URL}/api/admin/chart-forensics?${query}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    }
  );
  if (!response.ok) await apiError(response, `HTTP ${response.status}`);
  return response.json();
}
