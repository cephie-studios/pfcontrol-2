import { createHash } from 'node:crypto';
import { redisConnection } from '../db/connection.js';
import { prefixKey } from './cacheTtl.js';
import { fetchChartGen, type ChartGenResponse } from './chartGen.js';
import { WATERMARK_VERSION } from './chartWatermark.js';

const TTL_SEC = 12 * 60 * 60;
const MAX_CACHED_BYTES = 4 * 1024 * 1024;
const UPSTREAM_CACHE_BYTES = 192 * 1024 * 1024;
const MAX_UPSTREAM_ENTRY_BYTES = 32 * 1024 * 1024;

const inFlight = new Map<string, Promise<Buffer>>();
const upstreamPlates = new Map<string, Buffer>();
const upstreamInFlight = new Map<string, Promise<ChartGenResponse | null>>();
let upstreamBytes = 0;

function rememberUpstreamPlate(path: string, body: Buffer): void {
  if (body.length > MAX_UPSTREAM_ENTRY_BYTES || upstreamPlates.has(path)) {
    return;
  }
  upstreamPlates.set(path, body);
  upstreamBytes += body.length;
  for (const [oldest, old] of upstreamPlates) {
    if (upstreamBytes <= UPSTREAM_CACHE_BYTES) break;
    upstreamPlates.delete(oldest);
    upstreamBytes -= old.length;
  }
}

// A versioned path always names the same bytes, so one copy serves every viewer.
export function fetchCephiePlate(
  path: string
): Promise<ChartGenResponse | null> {
  const cached = upstreamPlates.get(path);
  if (cached) {
    upstreamPlates.delete(path);
    upstreamPlates.set(path, cached);
    return Promise.resolve({ status: 200, body: cached, version: null });
  }
  let pending = upstreamInFlight.get(path);
  if (!pending) {
    pending = fetchChartGen(path)
      .then((response) => {
        if (response?.status === 200) {
          rememberUpstreamPlate(path, response.body);
        }
        return response;
      })
      .finally(() => upstreamInFlight.delete(path));
    upstreamInFlight.set(path, pending);
  }
  return pending;
}

export function markedPlateKey(
  userId: string,
  label: string,
  version: string,
  icao: string,
  file: string
): string {
  const labelHash = createHash('sha256')
    .update(label)
    .digest('hex')
    .slice(0, 12);
  return prefixKey(
    `charts:cephie:marked:v${WATERMARK_VERSION}:${userId}:${labelHash}:${version}:${icao}:${file}`
  );
}

export async function readMarkedPlate(key: string): Promise<Buffer | null> {
  try {
    return await redisConnection.getBuffer(key);
  } catch (error) {
    console.warn('[Charts] Marked plate cache read failed:', error);
    return null;
  }
}

async function storeMarkedPlate(key: string, body: Buffer): Promise<void> {
  if (body.length > MAX_CACHED_BYTES) return;
  try {
    await redisConnection.set(key, body, 'EX', TTL_SEC);
  } catch (error) {
    console.warn('[Charts] Marked plate cache write failed:', error);
  }
}

export function createMarkedPlate(
  key: string,
  create: () => Promise<Buffer>
): Promise<Buffer> {
  let pending = inFlight.get(key);
  if (!pending) {
    pending = create()
      .then((body) => {
        void storeMarkedPlate(key, body);
        return body;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}
