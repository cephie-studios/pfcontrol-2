import { createHash } from 'node:crypto';
import { redisConnection } from '../db/connection.js';
import type { PublicPilotProfile } from '../services/publicPilotProfile.js';

// 7d - invalidate on profile changes
const REDIS_TTL_SEC = Math.min(
  Math.max(
    60,
    Number(process.env.OG_PROFILE_CACHE_TTL_SEC) || 7 * 24 * 60 * 60
  ),
  30 * 24 * 60 * 60
);

const REDIS_KEY_PREFIX = 'og:profile:png:v2:';

const HTTP_MAX_AGE_SEC = Math.min(
  REDIS_TTL_SEC,
  Math.max(300, Number(process.env.OG_PROFILE_HTTP_MAX_AGE_SEC) || 24 * 60 * 60)
);

const LRU_MAX = Math.min(
  500,
  Math.max(32, Number(process.env.OG_PROFILE_MEMORY_CACHE_MAX) || 128)
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

export function profileOgFingerprint(profile: PublicPilotProfile): string {
  const { user, privacySettings } = profile;
  const h = createHash('sha256');
  h.update(user.id);
  h.update('\n');
  h.update(user.username);
  h.update('\n');
  h.update(user.avatar ?? '');
  h.update('\n');
  h.update(user.bio ?? '');
  h.update('\n');
  h.update(user.is_admin ? '1' : '0');
  h.update('\n');
  h.update(
    (user.roles ?? [])
      .map((r) => `${r.id}:${r.name}:${r.color ?? ''}:${r.priority ?? 0}`)
      .join('|')
  );
  h.update('\n');
  h.update(JSON.stringify(user.statistics ?? {}));
  h.update('\n');
  h.update(
    user.rating
      ? `${user.rating.averageRating.toFixed(3)}:${user.rating.ratingCount}`
      : '-'
  );
  h.update('\n');
  h.update(JSON.stringify(privacySettings));
  h.update('\n');
  h.update(user.roblox_username ?? '');
  h.update('\n');
  h.update(user.vatsim_cid ?? '');
  h.update('\n');
  h.update(user.vatsim_rating_short ?? '');
  h.update('\n');
  h.update(JSON.stringify(user.background_image ?? null));
  return h.digest('hex').slice(0, 32);
}

export function profileOgRedisKey(profile: PublicPilotProfile): string {
  const fp = profileOgFingerprint(profile);
  const u = encodeURIComponent(profile.user.username.toLowerCase());
  return `${REDIS_KEY_PREFIX}${u}:${fp}`;
}

export function profileOgCacheControlHeader(): string {
  return `public, max-age=${HTTP_MAX_AGE_SEC}, s-maxage=${HTTP_MAX_AGE_SEC}, stale-while-revalidate=${HTTP_MAX_AGE_SEC}`;
}

export async function getCachedProfileOgPng(
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
      console.warn('[og] profile cache read:', err.message);
    }
    return null;
  }
}

export async function setCachedProfileOgPng(
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
      console.warn('[og] profile cache write:', err.message);
    }
  }
}