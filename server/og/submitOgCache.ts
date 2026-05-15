import { createHash } from 'node:crypto';
import { redisConnection } from '../db/connection.js';
import type { PublicSubmitSession } from '../services/publicSubmitSession.js';

const REDIS_TTL_SEC = Math.min(
  Math.max(60, Number(process.env.OG_SUBMIT_CACHE_TTL_SEC) || 60 * 60),
  7 * 24 * 60 * 60
);

const REDIS_KEY_PREFIX = 'og:submit:png:v1:';

const HTTP_MAX_AGE_SEC = Math.min(
  REDIS_TTL_SEC,
  Math.max(300, Number(process.env.OG_SUBMIT_HTTP_MAX_AGE_SEC) || 60 * 60)
);

const LRU_MAX = Math.min(
  500,
  Math.max(32, Number(process.env.OG_SUBMIT_MEMORY_CACHE_MAX) || 64)
);
const lru = new Map<string, Buffer>();

function touchLru(key: string, buf: Buffer) {
  if (lru.has(key)) lru.delete(key);
  lru.set(key, buf);
  while (lru.size > LRU_MAX) {
    const first = lru.keys().next().value as string | undefined;
    if (first) lru.delete(first);
  }
}

function getLru(key: string): Buffer | null {
  const buf = lru.get(key);
  if (!buf) return null;
  touchLru(key, buf);
  return buf;
}

export function submitOgFingerprint(session: PublicSubmitSession): string {
  const h = createHash('sha256');
  h.update(session.sessionId);
  h.update('\n');
  h.update(session.airportIcao);
  h.update('\n');
  h.update(session.activeRunway ?? '');
  h.update('\n');
  h.update(session.isPFATC ? '1' : '0');
  h.update('\n');
  h.update(session.isAdvancedATC ? '1' : '0');
  h.update('\n');
  h.update(String(session.flightCount));
  h.update('\n');
  h.update(session.atisLetter ?? '');
  h.update('\n');
  h.update(session.atisText ?? '');
  h.update('\n');
  h.update(session.controllerUsername ?? '');
  return h.digest('hex').slice(0, 32);
}

export function submitOgRedisKey(session: PublicSubmitSession): string {
  const fp = submitOgFingerprint(session);
  return `${REDIS_KEY_PREFIX}${session.sessionId}:${fp}`;
}

export function submitOgCacheControlHeader(): string {
  return `public, max-age=${HTTP_MAX_AGE_SEC}, s-maxage=${HTTP_MAX_AGE_SEC}, stale-while-revalidate=${HTTP_MAX_AGE_SEC}`;
}

export async function getCachedSubmitOgPng(
  redisKey: string
): Promise<Buffer | null> {
  const mem = getLru(redisKey);
  if (mem) return mem;

  try {
    const b64 = await redisConnection.get(redisKey);
    if (!b64) return null;
    const buf = Buffer.from(b64, 'base64');
    touchLru(redisKey, buf);
    return buf;
  } catch (err) {
    if (err instanceof Error) {
      console.warn('[og] submit cache read:', err.message);
    }
    return null;
  }
}

export async function setCachedSubmitOgPng(
  redisKey: string,
  png: Buffer
): Promise<void> {
  touchLru(redisKey, png);
  try {
    await redisConnection.set(
      redisKey,
      png.toString('base64'),
      'EX',
      REDIS_TTL_SEC
    );
  } catch (err) {
    if (err instanceof Error) {
      console.warn('[og] submit cache write:', err.message);
    }
  }
}