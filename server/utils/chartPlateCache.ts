import { createHash } from 'node:crypto';
import { redisConnection } from '../db/connection.js';
import { prefixKey } from './cacheTtl.js';
import { WATERMARK_VERSION } from './chartWatermark.js';

const TTL_SEC = 12 * 60 * 60;
const MAX_CACHED_BYTES = 4 * 1024 * 1024;

const inFlight = new Map<string, Promise<Buffer>>();

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
      .then(async (body) => {
        await storeMarkedPlate(key, body);
        return body;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}
