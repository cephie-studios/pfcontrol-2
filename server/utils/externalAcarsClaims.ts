import { redisConnection } from '../db/connection.js';
import { keys } from '../realtime/keys.js';
import { isDeveloperKeyActiveWithScope } from '../db/developer.js';

export const SESSION_CLAIM_SCOPE_ID = 'sessions.network_claim';

export const CLAIM_TTL_DEFAULT_MINUTES = 180;
export const CLAIM_TTL_MIN_MINUTES = 5;
export const CLAIM_TTL_MAX_MINUTES = 360;

export interface ExternalAcarsClaim {
  sessionId: string;
  keyId: string;
  userId: string;
  claimedAt: string;
  expiresAt: string;
}

function parseClaim(raw: string | null): ExternalAcarsClaim | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<ExternalAcarsClaim>;
    if (
      typeof c.sessionId !== 'string' ||
      typeof c.keyId !== 'string' ||
      typeof c.userId !== 'string' ||
      typeof c.claimedAt !== 'string' ||
      typeof c.expiresAt !== 'string'
    ) {
      return null;
    }
    return c as ExternalAcarsClaim;
  } catch {
    return null;
  }
}

export async function getExternalAcarsClaim(
  sessionId: string
): Promise<ExternalAcarsClaim | null> {
  return parseClaim(
    await redisConnection.get(keys.externalAcarsClaim(sessionId))
  );
}

export type SetClaimResult =
  | { ok: true; claim: ExternalAcarsClaim; renewed: boolean }
  | { ok: false; reason: 'claimed_by_other_key' };

export async function setExternalAcarsClaim(input: {
  sessionId: string;
  keyId: string;
  userId: string;
  ttlMinutes: number;
}): Promise<SetClaimResult> {
  const claimKey = keys.externalAcarsClaim(input.sessionId);
  const existing = parseClaim(await redisConnection.get(claimKey));
  if (existing && existing.keyId !== input.keyId) {
    return { ok: false, reason: 'claimed_by_other_key' };
  }

  const now = Date.now();
  const ttlSec = input.ttlMinutes * 60;
  const claim: ExternalAcarsClaim = {
    sessionId: input.sessionId,
    keyId: input.keyId,
    userId: input.userId,
    claimedAt: existing?.claimedAt ?? new Date(now).toISOString(),
    expiresAt: new Date(now + ttlSec * 1000).toISOString(),
  };

  const json = JSON.stringify(claim);
  if (existing) {
    await redisConnection.set(claimKey, json, 'EX', ttlSec);
  } else {
    const res = await redisConnection.set(claimKey, json, 'EX', ttlSec, 'NX');
    if (res !== 'OK') {
      const winner = parseClaim(await redisConnection.get(claimKey));
      if (!winner || winner.keyId !== input.keyId) {
        return { ok: false, reason: 'claimed_by_other_key' };
      }
    }
  }

  const indexKey = keys.externalAcarsClaimsByKey(input.keyId);
  await redisConnection.sadd(indexKey, input.sessionId);
  await redisConnection.expire(indexKey, CLAIM_TTL_MAX_MINUTES * 60);

  return { ok: true, claim, renewed: Boolean(existing) };
}

export async function releaseExternalAcarsClaim(
  sessionId: string,
  keyId: string
): Promise<boolean> {
  const claimKey = keys.externalAcarsClaim(sessionId);
  const existing = parseClaim(await redisConnection.get(claimKey));
  if (!existing || existing.keyId !== keyId) return false;
  await redisConnection.del(claimKey);
  await redisConnection.srem(keys.externalAcarsClaimsByKey(keyId), sessionId);
  return true;
}

export async function listExternalAcarsClaimsForKey(
  keyId: string
): Promise<ExternalAcarsClaim[]> {
  const indexKey = keys.externalAcarsClaimsByKey(keyId);
  const sessionIds = await redisConnection.smembers(indexKey);
  const claims: ExternalAcarsClaim[] = [];
  const stale: string[] = [];
  for (const sessionId of sessionIds) {
    const claim = await getExternalAcarsClaim(sessionId);
    if (claim && claim.keyId === keyId) claims.push(claim);
    else stale.push(sessionId);
  }
  if (stale.length) await redisConnection.srem(indexKey, ...stale);
  return claims;
}

export async function hasActiveExternalAcarsClaim(
  sessionId: string
): Promise<boolean> {
  const claim = await getExternalAcarsClaim(sessionId);
  if (!claim) return false;
  return isDeveloperKeyActiveWithScope(claim.keyId, SESSION_CLAIM_SCOPE_ID);
}
