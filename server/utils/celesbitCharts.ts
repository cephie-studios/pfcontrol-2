import { redisConnection } from '../db/connection.js';
import { prefixKey } from './cacheTtl.js';

const CHARTS_URL = 'https://celesbit.dev/api/v1/charts/';

const indexKey = (subject: string) =>
  prefixKey(`celesbit:charts:index:v2:${subject}`);
export const CHART_CACHE_SEC = 24 * 60 * 60;
const TOKEN_MARGIN_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;

export interface CelesbitPlate {
  kind: string;
  kindLabel: string;
  label: string;
  file: string;
  url: string;
}

export interface CelesbitCharts {
  airports: Record<string, CelesbitPlate[]>;
  tokensExpireAt: number;
}

export interface CelesbitPlateImage {
  contentType: string;
  body: Buffer;
}

interface UpstreamPlate {
  kind: string;
  kind_label: string;
  label: string;
  file: string;
  url: string;
}

interface UpstreamResponse {
  airports?: { icao: string; plates?: UpstreamPlate[] }[];
  expires_at?: string;
}

const indexInFlight = new Map<string, Promise<CelesbitCharts | null>>();
const plateInFlight = new Map<string, Promise<CelesbitPlateImage | null>>();

function parseUpstream(data: UpstreamResponse): CelesbitCharts {
  const airports: Record<string, CelesbitPlate[]> = {};
  for (const airport of data.airports ?? []) {
    const plates = (airport.plates ?? [])
      .filter((p) => p.file && p.url)
      .map((p) => ({
        kind: p.kind,
        kindLabel: p.kind_label,
        label: p.label,
        file: p.file,
        url: p.url,
      }));
    if (plates.length > 0) airports[airport.icao.toUpperCase()] = plates;
  }

  const expiry = data.expires_at ? Date.parse(data.expires_at) : NaN;
  return {
    airports,
    tokensExpireAt: Number.isFinite(expiry) ? expiry - TOKEN_MARGIN_MS : 0,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readIndex(subject: string): Promise<CelesbitCharts | null> {
  try {
    const raw = await redisConnection.get(indexKey(subject));
    return raw ? (JSON.parse(raw) as CelesbitCharts) : null;
  } catch (e) {
    console.warn('[Celesbit] Redis read failed:', e);
    return null;
  }
}

async function fetchIndex(subject: string): Promise<CelesbitCharts | null> {
  const apiKey = process.env.CELESBIT_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[Celesbit] CELESBIT_API_KEY not set');
    return null;
  }

  try {
    const url = `${CHARTS_URL}?subject=${encodeURIComponent(subject)}`;
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `ApiKey ${apiKey}` },
    });
    if (res.status === 403) {
      console.warn('[Celesbit] Charts refused for this subject');
      return null;
    }
    if (!res.ok) {
      console.error(`[Celesbit] Charts request failed: HTTP ${res.status}`);
      return null;
    }
    const charts = parseUpstream((await res.json()) as UpstreamResponse);
    const ttl = charts.tokensExpireAt
      ? Math.min(
          CHART_CACHE_SEC,
          Math.floor((charts.tokensExpireAt - Date.now()) / 1000)
        )
      : CHART_CACHE_SEC;
    if (ttl > 0) {
      try {
        await redisConnection.set(
          indexKey(subject),
          JSON.stringify(charts),
          'EX',
          ttl
        );
      } catch (e) {
        console.warn('[Celesbit] Redis write failed:', e);
      }
    }
    return charts;
  } catch (e) {
    console.error('[Celesbit] Charts request failed:', e);
    return null;
  }
}

function refreshIndex(subject: string): Promise<CelesbitCharts | null> {
  let pending = indexInFlight.get(subject);
  if (!pending) {
    pending = fetchIndex(subject).finally(() => indexInFlight.delete(subject));
    indexInFlight.set(subject, pending);
  }
  return pending;
}

export async function getCelesbitCharts(
  subject: string
): Promise<CelesbitCharts | null> {
  return (await readIndex(subject)) ?? refreshIndex(subject);
}

async function fetchPlate(
  subject: string,
  icao: string,
  file: string
): Promise<CelesbitPlateImage | null> {
  let charts = await getCelesbitCharts(subject);
  let plate = charts?.airports[icao]?.find((p) => p.file === file);
  if (!charts || !plate) return null;

  if (charts.tokensExpireAt <= Date.now()) {
    charts = await refreshIndex(subject);
    plate = charts?.airports[icao]?.find((p) => p.file === file);
    if (!plate) return null;
  }

  try {
    const res = await fetchWithTimeout(plate.url);
    if (res.status === 403) {
      // Barred since the index was cached: drop it so links get re-minted.
      console.warn(`[Celesbit] Plate ${icao}/${file} refused for this subject`);
      await redisConnection.del(indexKey(subject)).catch(() => undefined);
      return null;
    }
    if (!res.ok) {
      console.error(
        `[Celesbit] Plate ${icao}/${file} request failed: HTTP ${res.status}`
      );
      return null;
    }
    return {
      contentType: res.headers.get('content-type') ?? 'image/webp',
      body: Buffer.from(await res.arrayBuffer()),
    };
  } catch (e) {
    console.error(`[Celesbit] Plate ${icao}/${file} request failed:`, e);
    return null;
  }
}

export async function getCelesbitPlate(
  subject: string,
  icao: string,
  file: string
): Promise<CelesbitPlateImage | null> {
  const key = `${subject}:${icao}:${file}`;
  let pending = plateInFlight.get(key);
  if (!pending) {
    pending = fetchPlate(subject, icao, file).finally(() =>
      plateInFlight.delete(key)
    );
    plateInFlight.set(key, pending);
  }
  return pending;
}
