import crypto from 'crypto';
import { redisConnection } from '../db/connection.js';
import { keys } from '../realtime/keys.js';
import { isDeveloperKeyActiveWithScope } from '../db/developer.js';

export const SESSION_CLAIM_SCOPE_ID = 'sessions.network_claim';

export const CLAIM_TTL_DEFAULT_MINUTES = 180;
export const CLAIM_TTL_MIN_MINUTES = 5;
export const CLAIM_TTL_MAX_MINUTES = 360;
export const CLAIM_REVIEW_SECONDS = 60;
export const CLAIM_DECLINE_COOLDOWN_MINUTES = 15;
const CLAIM_REQUEST_LOG_SECONDS = 24 * 60 * 60;

export interface ExternalAcarsClaim {
  sessionId: string;
  keyId: string;
  userId: string;
  claimedAt: string;
  expiresAt: string;
}

export interface ExternalAcarsClaimRequest {
  requestId: string;
  sessionId: string;
  keyId: string;
  userId: string;
  requesterName: string;
  ttlMinutes: number;
  requestedAt: string;
  decidesAt: string;
  attempts24h: number;
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

function parseRequest(raw: string | null): ExternalAcarsClaimRequest | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<ExternalAcarsClaimRequest>;
    if (
      typeof r.requestId !== 'string' ||
      typeof r.sessionId !== 'string' ||
      typeof r.keyId !== 'string' ||
      typeof r.userId !== 'string' ||
      typeof r.requesterName !== 'string' ||
      typeof r.ttlMinutes !== 'number' ||
      typeof r.requestedAt !== 'string' ||
      typeof r.decidesAt !== 'string' ||
      typeof r.attempts24h !== 'number'
    ) {
      return null;
    }
    return r as ExternalAcarsClaimRequest;
  } catch {
    return null;
  }
}

async function indexSessionForKey(keyId: string, sessionId: string) {
  const indexKey = keys.externalAcarsClaimsByKey(keyId);
  await redisConnection.sadd(indexKey, sessionId);
  await redisConnection.expire(
    indexKey,
    CLAIM_TTL_MAX_MINUTES * 60 + CLAIM_REVIEW_SECONDS
  );
}

export async function getExternalAcarsClaimRequest(
  sessionId: string
): Promise<ExternalAcarsClaimRequest | null> {
  return parseRequest(
    await redisConnection.get(keys.externalAcarsClaimRequest(sessionId))
  );
}

async function activateClaimRequest(
  request: ExternalAcarsClaimRequest,
  activatedAt: number
): Promise<ExternalAcarsClaim | null> {
  const claimKey = keys.externalAcarsClaim(request.sessionId);
  const expiresMs = activatedAt + request.ttlMinutes * 60 * 1000;
  const remainingSec = Math.ceil((expiresMs - Date.now()) / 1000);
  if (remainingSec <= 0) {
    await redisConnection.del(
      keys.externalAcarsClaimRequest(request.sessionId)
    );
    return null;
  }

  const claim: ExternalAcarsClaim = {
    sessionId: request.sessionId,
    keyId: request.keyId,
    userId: request.userId,
    claimedAt: new Date(activatedAt).toISOString(),
    expiresAt: new Date(expiresMs).toISOString(),
  };
  const res = await redisConnection.set(
    claimKey,
    JSON.stringify(claim),
    'EX',
    remainingSec,
    'NX'
  );
  await redisConnection.del(keys.externalAcarsClaimRequest(request.sessionId));
  if (res !== 'OK') {
    const winner = parseClaim(await redisConnection.get(claimKey));
    return winner && winner.keyId === request.keyId ? winner : null;
  }
  await indexSessionForKey(request.keyId, request.sessionId);
  return claim;
}

export async function promoteDueExternalAcarsClaimRequest(
  sessionId: string
): Promise<ExternalAcarsClaim | null> {
  const request = await getExternalAcarsClaimRequest(sessionId);
  if (!request) return null;
  const decidesAt = Date.parse(request.decidesAt);
  if (Date.now() < decidesAt) return null;
  return activateClaimRequest(request, decidesAt);
}

export async function getExternalAcarsClaim(
  sessionId: string
): Promise<ExternalAcarsClaim | null> {
  const claim = parseClaim(
    await redisConnection.get(keys.externalAcarsClaim(sessionId))
  );
  if (claim) return claim;
  return promoteDueExternalAcarsClaimRequest(sessionId);
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

  await indexSessionForKey(input.keyId, input.sessionId);

  return { ok: true, claim, renewed: Boolean(existing) };
}

export type RequestClaimResult =
  | { status: 'renewed'; claim: ExternalAcarsClaim }
  | { status: 'pending'; request: ExternalAcarsClaimRequest; created: boolean }
  | { status: 'declined'; retryAt: string }
  | { status: 'conflict' };

export async function requestExternalAcarsClaim(input: {
  sessionId: string;
  keyId: string;
  userId: string;
  requesterName: string;
  ttlMinutes: number;
}): Promise<RequestClaimResult> {
  const existing = await getExternalAcarsClaim(input.sessionId);
  if (existing) {
    if (existing.keyId !== input.keyId) return { status: 'conflict' };
    const renewed = await setExternalAcarsClaim(input);
    return renewed.ok
      ? { status: 'renewed', claim: renewed.claim }
      : { status: 'conflict' };
  }

  const pending = await getExternalAcarsClaimRequest(input.sessionId);
  if (pending) {
    return pending.keyId === input.keyId
      ? { status: 'pending', request: pending, created: false }
      : { status: 'conflict' };
  }

  const cooldownSec = await redisConnection.ttl(
    keys.externalAcarsClaimDeclined(input.sessionId, input.keyId)
  );
  if (cooldownSec > 0) {
    return {
      status: 'declined',
      retryAt: new Date(Date.now() + cooldownSec * 1000).toISOString(),
    };
  }

  const attemptsKey = keys.externalAcarsClaimAttempts(
    input.sessionId,
    input.keyId
  );
  const attempts24h = await redisConnection.incr(attemptsKey);
  if (attempts24h === 1) {
    await redisConnection.expire(attemptsKey, CLAIM_REQUEST_LOG_SECONDS);
  }

  const now = Date.now();
  const request: ExternalAcarsClaimRequest = {
    requestId: crypto.randomBytes(12).toString('hex'),
    sessionId: input.sessionId,
    keyId: input.keyId,
    userId: input.userId,
    requesterName: input.requesterName,
    ttlMinutes: input.ttlMinutes,
    requestedAt: new Date(now).toISOString(),
    decidesAt: new Date(now + CLAIM_REVIEW_SECONDS * 1000).toISOString(),
    attempts24h,
  };
  const res = await redisConnection.set(
    keys.externalAcarsClaimRequest(input.sessionId),
    JSON.stringify(request),
    'EX',
    CLAIM_REVIEW_SECONDS + input.ttlMinutes * 60,
    'NX'
  );
  if (res !== 'OK') {
    const winner = await getExternalAcarsClaimRequest(input.sessionId);
    return winner && winner.keyId === input.keyId
      ? { status: 'pending', request: winner, created: false }
      : { status: 'conflict' };
  }
  await indexSessionForKey(input.keyId, input.sessionId);
  await redisConnection.set(
    keys.externalAcarsClaimRequestLog(request.requestId),
    JSON.stringify(request),
    'EX',
    CLAIM_REQUEST_LOG_SECONDS
  );
  return { status: 'pending', request, created: true };
}

export type DecideClaimResult =
  | {
      ok: true;
      request: ExternalAcarsClaimRequest;
      claim: ExternalAcarsClaim | null;
    }
  | { ok: false; reason: 'not_found' | 'expired' };

export async function decideExternalAcarsClaimRequest(
  sessionId: string,
  decision: 'allow' | 'decline'
): Promise<DecideClaimResult> {
  const request = await getExternalAcarsClaimRequest(sessionId);
  if (!request) return { ok: false, reason: 'not_found' };
  if (Date.now() >= Date.parse(request.decidesAt)) {
    await promoteDueExternalAcarsClaimRequest(sessionId);
    return { ok: false, reason: 'expired' };
  }

  if (decision === 'allow') {
    const claim = await activateClaimRequest(request, Date.now());
    return { ok: true, request, claim };
  }

  await redisConnection.del(keys.externalAcarsClaimRequest(sessionId));
  await redisConnection.set(
    keys.externalAcarsClaimDeclined(sessionId, request.keyId),
    new Date().toISOString(),
    'EX',
    CLAIM_DECLINE_COOLDOWN_MINUTES * 60
  );
  const raced = parseClaim(
    await redisConnection.get(keys.externalAcarsClaim(sessionId))
  );
  if (
    raced &&
    raced.keyId === request.keyId &&
    raced.claimedAt === request.decidesAt
  ) {
    await redisConnection.del(keys.externalAcarsClaim(sessionId));
  }
  await redisConnection.srem(
    keys.externalAcarsClaimsByKey(request.keyId),
    sessionId
  );
  return { ok: true, request, claim: null };
}

export async function releaseExternalAcarsClaim(
  sessionId: string,
  keyId: string
): Promise<boolean> {
  const claimKey = keys.externalAcarsClaim(sessionId);
  const requestKey = keys.externalAcarsClaimRequest(sessionId);
  const existing = parseClaim(await redisConnection.get(claimKey));
  const request = parseRequest(await redisConnection.get(requestKey));
  let released = false;
  if (existing?.keyId === keyId) {
    await redisConnection.del(claimKey);
    released = true;
  }
  if (request?.keyId === keyId) {
    await redisConnection.del(requestKey);
    released = true;
  }
  if (released) {
    await redisConnection.srem(keys.externalAcarsClaimsByKey(keyId), sessionId);
  }
  return released;
}

export async function getExternalAcarsClaims(
  sessionIds: string[]
): Promise<Map<string, ExternalAcarsClaim>> {
  const map = new Map<string, ExternalAcarsClaim>();
  if (sessionIds.length === 0) return map;
  const raws = await redisConnection.mget(
    ...sessionIds.map((id) => keys.externalAcarsClaim(id))
  );
  const missing: string[] = [];
  sessionIds.forEach((id, i) => {
    const claim = parseClaim(raws[i] ?? null);
    if (claim) map.set(id, claim);
    else missing.push(id);
  });
  if (missing.length === 0) return map;

  const requestRaws = await redisConnection.mget(
    ...missing.map((id) => keys.externalAcarsClaimRequest(id))
  );
  for (let i = 0; i < missing.length; i++) {
    const request = parseRequest(requestRaws[i] ?? null);
    if (!request || Date.now() < Date.parse(request.decidesAt)) continue;
    const claim = await promoteDueExternalAcarsClaimRequest(missing[i]);
    if (claim) map.set(missing[i], claim);
  }
  return map;
}

export async function forceReleaseExternalAcarsClaim(
  sessionId: string
): Promise<boolean> {
  const claimKey = keys.externalAcarsClaim(sessionId);
  const requestKey = keys.externalAcarsClaimRequest(sessionId);
  const existing = parseClaim(await redisConnection.get(claimKey));
  const request = parseRequest(await redisConnection.get(requestKey));
  if (!existing && !request) return false;
  if (existing) {
    await redisConnection.del(claimKey);
    await redisConnection.srem(
      keys.externalAcarsClaimsByKey(existing.keyId),
      sessionId
    );
  }
  if (request) {
    await redisConnection.del(requestKey);
    await redisConnection.srem(
      keys.externalAcarsClaimsByKey(request.keyId),
      sessionId
    );
  }
  return true;
}

export async function listExternalAcarsClaimsForKey(keyId: string): Promise<{
  claims: ExternalAcarsClaim[];
  pending: ExternalAcarsClaimRequest[];
}> {
  const indexKey = keys.externalAcarsClaimsByKey(keyId);
  const sessionIds = await redisConnection.smembers(indexKey);
  const claims: ExternalAcarsClaim[] = [];
  const pending: ExternalAcarsClaimRequest[] = [];
  const stale: string[] = [];
  for (const sessionId of sessionIds) {
    const claim = await getExternalAcarsClaim(sessionId);
    if (claim && claim.keyId === keyId) {
      claims.push(claim);
      continue;
    }
    const request = await getExternalAcarsClaimRequest(sessionId);
    if (request && request.keyId === keyId) pending.push(request);
    else stale.push(sessionId);
  }
  if (stale.length) await redisConnection.srem(indexKey, ...stale);
  return { claims, pending };
}

export type ClaimStatus =
  | { status: 'active'; claimedAt: string; expiresAt: string }
  | { status: 'pending'; requestedAt: string; decidesAt: string }
  | { status: 'declined'; retryAt: string }
  | { status: 'taken' }
  | { status: 'none' };

export async function getExternalAcarsClaimStatus(
  sessionId: string,
  keyId: string
): Promise<ClaimStatus> {
  const claim = await getExternalAcarsClaim(sessionId);
  if (claim) {
    return claim.keyId === keyId
      ? {
          status: 'active',
          claimedAt: claim.claimedAt,
          expiresAt: claim.expiresAt,
        }
      : { status: 'taken' };
  }
  const request = await getExternalAcarsClaimRequest(sessionId);
  if (request) {
    return request.keyId === keyId
      ? {
          status: 'pending',
          requestedAt: request.requestedAt,
          decidesAt: request.decidesAt,
        }
      : { status: 'taken' };
  }
  const cooldownSec = await redisConnection.ttl(
    keys.externalAcarsClaimDeclined(sessionId, keyId)
  );
  if (cooldownSec > 0) {
    return {
      status: 'declined',
      retryAt: new Date(Date.now() + cooldownSec * 1000).toISOString(),
    };
  }
  return { status: 'none' };
}

export async function getLoggedExternalAcarsClaimRequest(
  requestId: string
): Promise<ExternalAcarsClaimRequest | null> {
  if (!/^[a-f0-9]{24}$/.test(requestId)) return null;
  return parseRequest(
    await redisConnection.get(keys.externalAcarsClaimRequestLog(requestId))
  );
}

export async function hasActiveExternalAcarsClaim(
  sessionId: string
): Promise<boolean> {
  const claim = await getExternalAcarsClaim(sessionId);
  if (!claim) return false;
  return isDeveloperKeyActiveWithScope(claim.keyId, SESSION_CLAIM_SCOPE_ID);
}
