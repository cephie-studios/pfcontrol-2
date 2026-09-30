import { redisConnection } from '../db/connection.js';
import { prefixKey } from './cacheTtl.js';

const CHARTS_URL = 'https://celesbit.dev/api/v1/charts/';
const INDEX_KEY = prefixKey('celesbit:charts:index:v1');
const plateKey = (icao: string, file: string) =>
  prefixKey(`celesbit:charts:plate:v1:${icao}:${file}`);
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

let indexInFlight: Promise<CelesbitCharts | null> | null = null;
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

async function readIndex(): Promise<CelesbitCharts | null> {
  try {
    const raw = await redisConnection.get(INDEX_KEY);
    return raw ? (JSON.parse(raw) as CelesbitCharts) : null;
  } catch (e) {
    console.warn('[Celesbit] Redis read failed:', e);
    return null;
  }
}

async function fetchIndex(): Promise<CelesbitCharts | null> {
  const apiKey = process.env.CELESBIT_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[Celesbit] CELESBIT_API_KEY not set');
    return null;
  }

  try {
    const res = await fetchWithTimeout(CHARTS_URL, {
      headers: { Authorization: `ApiKey ${apiKey}` },
    });
    if (!res.ok) {
      console.error(`[Celesbit] Charts request failed: HTTP ${res.status}`);
      return null;
    }
    const charts = parseUpstream((await res.json()) as UpstreamResponse);
    try {
      await redisConnection.set(
        INDEX_KEY,
        JSON.stringify(charts),
        'EX',
        CHART_CACHE_SEC
      );
    } catch (e) {
      console.warn('[Celesbit] Redis write failed:', e);
    }
    return charts;
  } catch (e) {
    console.error('[Celesbit] Charts request failed:', e);
    return null;
  }
}

function refreshIndex(): Promise<CelesbitCharts | null> {
  if (!indexInFlight) {
    indexInFlight = fetchIndex().finally(() => {
      indexInFlight = null;
    });
  }
  return indexInFlight;
}

export async function getCelesbitCharts(): Promise<CelesbitCharts | null> {
  return (await readIndex()) ?? refreshIndex();
}

async function readPlate(key: string): Promise<CelesbitPlateImage | null> {
  try {
    const [contentType, body] = await Promise.all([
      redisConnection.hget(key, 'type'),
      redisConnection.hgetBuffer(key, 'body'),
    ]);
    return contentType && body ? { contentType, body } : null;
  } catch (e) {
    console.warn('[Celesbit] Redis plate read failed:', e);
    return null;
  }
}

async function fetchPlate(
  icao: string,
  file: string
): Promise<CelesbitPlateImage | null> {
  let charts = await getCelesbitCharts();
  let plate = charts?.airports[icao]?.find((p) => p.file === file);
  if (!charts || !plate) return null;

  if (charts.tokensExpireAt <= Date.now()) {
    charts = await refreshIndex();
    plate = charts?.airports[icao]?.find((p) => p.file === file);
    if (!plate) return null;
  }

  try {
    const res = await fetchWithTimeout(plate.url);
    if (!res.ok) {
      console.error(
        `[Celesbit] Plate ${icao}/${file} request failed: HTTP ${res.status}`
      );
      return null;
    }
    const image: CelesbitPlateImage = {
      contentType: res.headers.get('content-type') ?? 'image/webp',
      body: Buffer.from(await res.arrayBuffer()),
    };

    const key = plateKey(icao, file);
    try {
      await redisConnection
        .multi()
        .hset(key, { type: image.contentType, body: image.body })
        .expire(key, CHART_CACHE_SEC)
        .exec();
    } catch (e) {
      console.warn('[Celesbit] Redis plate write failed:', e);
    }
    return image;
  } catch (e) {
    console.error(`[Celesbit] Plate ${icao}/${file} request failed:`, e);
    return null;
  }
}

export async function getCelesbitPlate(
  icao: string,
  file: string
): Promise<CelesbitPlateImage | null> {
  const key = plateKey(icao, file);
  const cached = await readPlate(key);
  if (cached) return cached;

  let pending = plateInFlight.get(key);
  if (!pending) {
    pending = fetchPlate(icao, file).finally(() => plateInFlight.delete(key));
    plateInFlight.set(key, pending);
  }
  return pending;
}
