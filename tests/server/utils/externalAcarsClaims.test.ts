import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    store,
    sets,
    isDeveloperKeyActiveWithScope: vi.fn(),
    redis: {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      set: vi.fn(async (k: string, v: string, ...args: unknown[]) => {
        if (args.includes('NX') && store.has(k)) return null;
        store.set(k, v);
        return 'OK';
      }),
      del: vi.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
      sadd: vi.fn(async (k: string, ...members: string[]) => {
        const s = sets.get(k) ?? new Set<string>();
        members.forEach((m) => s.add(m));
        sets.set(k, s);
        return members.length;
      }),
      srem: vi.fn(async (k: string, ...members: string[]) => {
        members.forEach((m) => sets.get(k)?.delete(m));
        return members.length;
      }),
      smembers: vi.fn(async (k: string) => [...(sets.get(k) ?? [])]),
      expire: vi.fn(async () => 1),
      incr: vi.fn(async (k: string) => {
        const n = Number(store.get(k) ?? 0) + 1;
        store.set(k, String(n));
        return n;
      }),
      ttl: vi.fn(async (k: string) => (store.has(k) ? 1800 : -2)),
      mget: vi.fn(async (...ks: string[]) =>
        ks.map((k) => store.get(k) ?? null)
      ),
    },
  };
});

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {},
  redisConnection: mocks.redis,
}));

vi.mock('../../../server/db/developer.js', () => ({
  isDeveloperKeyActiveWithScope: mocks.isDeveloperKeyActiveWithScope,
}));

import {
  CLAIM_REVIEW_SECONDS,
  SESSION_CLAIM_SCOPE_ID,
  decideExternalAcarsClaimRequest,
  getExternalAcarsClaim,
  getExternalAcarsClaimStatus,
  getLoggedExternalAcarsClaimRequest,
  hasActiveExternalAcarsClaim,
  listExternalAcarsClaimsForKey,
  releaseExternalAcarsClaim,
  requestExternalAcarsClaim,
  setExternalAcarsClaim,
} from '../../../server/utils/externalAcarsClaims.js';

const base = { sessionId: 'Ab12Cd34', userId: 'u1', ttlMinutes: 60 };

describe('externalAcarsClaims', () => {
  beforeEach(() => {
    mocks.store.clear();
    mocks.sets.clear();
    mocks.isDeveloperKeyActiveWithScope.mockReset();
  });

  it('creates a claim, then renews it for the same key', async () => {
    const first = await setExternalAcarsClaim({ ...base, keyId: 'k1' });
    expect(first).toMatchObject({ ok: true, renewed: false });

    const second = await setExternalAcarsClaim({ ...base, keyId: 'k1' });
    expect(second).toMatchObject({ ok: true, renewed: true });
    if (first.ok && second.ok) {
      expect(second.claim.claimedAt).toBe(first.claim.claimedAt);
    }
  });

  it('refuses a claim held by another key', async () => {
    await setExternalAcarsClaim({ ...base, keyId: 'k1' });
    const res = await setExternalAcarsClaim({ ...base, keyId: 'k2' });
    expect(res).toEqual({ ok: false, reason: 'claimed_by_other_key' });
  });

  it('only lets the owning key release a claim', async () => {
    await setExternalAcarsClaim({ ...base, keyId: 'k1' });
    expect(await releaseExternalAcarsClaim(base.sessionId, 'k2')).toBe(false);
    expect(await releaseExternalAcarsClaim(base.sessionId, 'k1')).toBe(true);
    expect(await listExternalAcarsClaimsForKey('k1')).toEqual({
      claims: [],
      pending: [],
    });
  });

  it('lists only live claims for a key', async () => {
    await setExternalAcarsClaim({ ...base, keyId: 'k1' });
    await setExternalAcarsClaim({
      ...base,
      sessionId: 'Zz99Yy88',
      keyId: 'k1',
    });
    // Simulate the second claim expiring in Redis.
    mocks.store.delete(
      [...mocks.store.keys()].find((k) => k.endsWith('Zz99Yy88'))!
    );

    const { claims } = await listExternalAcarsClaimsForKey('k1');
    expect(claims.map((c) => c.sessionId)).toEqual([base.sessionId]);
  });

  it('treats a claim as inactive once the key loses access', async () => {
    await setExternalAcarsClaim({ ...base, keyId: 'k1' });

    mocks.isDeveloperKeyActiveWithScope.mockResolvedValue(true);
    expect(await hasActiveExternalAcarsClaim(base.sessionId)).toBe(true);
    expect(mocks.isDeveloperKeyActiveWithScope).toHaveBeenCalledWith(
      'k1',
      SESSION_CLAIM_SCOPE_ID
    );

    mocks.isDeveloperKeyActiveWithScope.mockResolvedValue(false);
    expect(await hasActiveExternalAcarsClaim(base.sessionId)).toBe(false);
  });

  it('reports no claim for unclaimed sessions without hitting the DB', async () => {
    expect(await hasActiveExternalAcarsClaim('Nn00Nn00')).toBe(false);
    expect(mocks.isDeveloperKeyActiveWithScope).not.toHaveBeenCalled();
  });

  describe('controller review', () => {
    const request = { ...base, keyId: 'k1', requesterName: 'Scope' };

    afterEach(() => {
      vi.useRealTimers();
    });

    it('holds a new claim as pending until the review window ends', async () => {
      vi.useFakeTimers();
      const res = await requestExternalAcarsClaim(request);
      expect(res).toMatchObject({ status: 'pending', created: true });
      expect(await getExternalAcarsClaim(base.sessionId)).toBeNull();

      const again = await requestExternalAcarsClaim(request);
      expect(again).toMatchObject({ status: 'pending', created: false });

      vi.advanceTimersByTime(CLAIM_REVIEW_SECONDS * 1000);
      const claim = await getExternalAcarsClaim(base.sessionId);
      expect(claim).toMatchObject({ keyId: 'k1' });
      if (res.status === 'pending') {
        expect(claim?.claimedAt).toBe(res.request.decidesAt);
      }
      expect(
        await getExternalAcarsClaimStatus(base.sessionId, 'k1')
      ).toMatchObject({ status: 'active' });
    });

    it('activates immediately when a controller allows it', async () => {
      await requestExternalAcarsClaim(request);
      const res = await decideExternalAcarsClaimRequest(
        base.sessionId,
        'allow'
      );
      expect(res).toMatchObject({ ok: true, claim: { keyId: 'k1' } });
      expect(await getExternalAcarsClaim(base.sessionId)).toMatchObject({
        keyId: 'k1',
      });
    });

    it('drops a declined request and blocks re-requests during the cooldown', async () => {
      vi.useFakeTimers();
      await requestExternalAcarsClaim(request);
      expect(
        await decideExternalAcarsClaimRequest(base.sessionId, 'decline')
      ).toMatchObject({ ok: true, claim: null });

      vi.advanceTimersByTime(CLAIM_REVIEW_SECONDS * 1000);
      expect(await getExternalAcarsClaim(base.sessionId)).toBeNull();
      expect(await requestExternalAcarsClaim(request)).toMatchObject({
        status: 'declined',
      });
      expect(
        await getExternalAcarsClaimStatus(base.sessionId, 'k1')
      ).toMatchObject({ status: 'declined' });
    });

    it('rejects a decision once the window has passed', async () => {
      vi.useFakeTimers();
      await requestExternalAcarsClaim(request);
      vi.advanceTimersByTime(CLAIM_REVIEW_SECONDS * 1000);
      expect(
        await decideExternalAcarsClaimRequest(base.sessionId, 'decline')
      ).toEqual({ ok: false, reason: 'expired' });
      expect(await getExternalAcarsClaim(base.sessionId)).toMatchObject({
        keyId: 'k1',
      });
    });

    it('refuses requests from another key while one is pending', async () => {
      await requestExternalAcarsClaim(request);
      expect(
        await requestExternalAcarsClaim({ ...request, keyId: 'k2' })
      ).toEqual({ status: 'conflict' });
      expect(await getExternalAcarsClaimStatus(base.sessionId, 'k2')).toEqual({
        status: 'taken',
      });
    });

    it('renews an active claim without another review', async () => {
      await setExternalAcarsClaim({ ...base, keyId: 'k1' });
      expect(await requestExternalAcarsClaim(request)).toMatchObject({
        status: 'renewed',
      });
    });

    it('counts attempts and keeps a log entry that outlives the request', async () => {
      const first = await requestExternalAcarsClaim(request);
      await decideExternalAcarsClaimRequest(base.sessionId, 'allow');
      await releaseExternalAcarsClaim(base.sessionId, 'k1');
      const second = await requestExternalAcarsClaim(request);
      if (first.status !== 'pending' || second.status !== 'pending') {
        throw new Error('expected pending requests');
      }
      expect(first.request.attempts24h).toBe(1);
      expect(second.request.attempts24h).toBe(2);
      expect(first.request.requestId).not.toBe(second.request.requestId);

      await decideExternalAcarsClaimRequest(base.sessionId, 'decline');
      expect(
        await getLoggedExternalAcarsClaimRequest(second.request.requestId)
      ).toMatchObject({ keyId: 'k1', sessionId: base.sessionId });
      expect(await getLoggedExternalAcarsClaimRequest('nope')).toBeNull();
    });

    it('lets the requesting key withdraw a pending request', async () => {
      await requestExternalAcarsClaim(request);
      expect(await listExternalAcarsClaimsForKey('k1')).toMatchObject({
        claims: [],
        pending: [{ sessionId: base.sessionId }],
      });
      expect(await releaseExternalAcarsClaim(base.sessionId, 'k1')).toBe(true);
      expect(await getExternalAcarsClaimStatus(base.sessionId, 'k1')).toEqual({
        status: 'none',
      });
    });
  });
});
