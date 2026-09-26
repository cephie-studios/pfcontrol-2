import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  SESSION_CLAIM_SCOPE_ID,
  hasActiveExternalAcarsClaim,
  listExternalAcarsClaimsForKey,
  releaseExternalAcarsClaim,
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
    expect(await listExternalAcarsClaimsForKey('k1')).toEqual([]);
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

    const claims = await listExternalAcarsClaimsForKey('k1');
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
});
