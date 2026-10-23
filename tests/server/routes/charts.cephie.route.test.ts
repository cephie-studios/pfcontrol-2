import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRequest } from '../helpers/appRequest.js';

const mocks = vi.hoisted(() => ({
  fetchChartGen: vi.fn(),
  hasPlan: vi.fn(),
  watermarkPlate: vi.fn(),
  redis: new Map<string, Buffer>(),
  user: { userId: 'u1' } as { userId: string; username?: string } | undefined,
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {},
  redisConnection: {
    getBuffer: async (key: string) => mocks.redis.get(key) ?? null,
    set: async (key: string, value: Buffer) => {
      mocks.redis.set(key, value);
      return 'OK';
    },
  },
}));

vi.mock('../../../server/utils/chartGen.js', () => ({
  fetchChartGen: mocks.fetchChartGen,
}));

vi.mock('../../../server/utils/chartWatermark.js', () => ({
  watermarkIdentity: (userId: string, username: string) => ({
    label: `${username}:${userId}`,
    seedKey: `seed:${userId}`,
  }),
  watermarkPlate: mocks.watermarkPlate,
  WATERMARK_VERSION: 2,
}));

vi.mock('../../../server/billing/entitlements.js', () => ({
  hasPlan: mocks.hasPlan,
}));

vi.mock('../../../server/db/adminBilling.js', () => ({
  getChartSources: vi.fn(),
  isChartSourceEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../server/middleware/auth.js', () => ({
  default: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = mocks.user;
    next();
  },
}));

vi.mock('../../../server/middleware/security.js', () => ({
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import chartsRouter from '../../../server/routes/charts.js';

const VERSION = 'abcdef012345';
const FULL = `/cephie/${VERSION}/EGKK/sid-1.webp`;
const PREVIEW = `/cephie/${VERSION}/EGKK/sid-1.preview.webp`;

describe('GET /api/charts/cephie/:version/:icao/:file', () => {
  const app = express();
  app.use('/', chartsRouter);

  const fetchAs = (path: string, headers: Record<string, string> = {}) =>
    appRequest(app, 'GET', path, undefined, headers);

  beforeEach(() => {
    mocks.user = { userId: `u${Math.random()}` };
    mocks.redis.clear();
    mocks.hasPlan.mockReset().mockResolvedValue(true);
    mocks.watermarkPlate.mockReset().mockResolvedValue(Buffer.from('marked'));
    mocks.fetchChartGen.mockReset().mockResolvedValue({
      status: 200,
      body: Buffer.from('webp'),
      version: VERSION,
    });
  });

  it('serves a full-size plate to a supporter fetching it', async () => {
    const res = await fetchAs(FULL, { 'Sec-Fetch-Dest': 'empty' });
    expect(res.status).toBe(200);
  });

  it.each(['document', 'image', 'iframe', 'embed', 'object'])(
    'refuses a full-size plate requested as %s',
    async (destination) => {
      const res = await fetchAs(FULL, { 'Sec-Fetch-Dest': destination });
      expect(res.status).toBe(403);
      expect(mocks.fetchChartGen).not.toHaveBeenCalled();
    }
  );

  it('still lets previews load as images', async () => {
    const res = await fetchAs(PREVIEW, { 'Sec-Fetch-Dest': 'image' });
    expect(res.status).toBe(200);
  });

  it('marks full-size plates for the viewer and never sends the original', async () => {
    mocks.user = { userId: 'u9', username: 'pilot' };
    const res = await fetchAs(FULL);
    expect(res.status).toBe(200);
    expect(mocks.watermarkPlate).toHaveBeenCalledWith(expect.any(Buffer), {
      label: 'pilot:u9',
      seedKey: 'seed:u9',
    });
    expect(res.body).toBe('marked');
  });

  it('marks a plate once per viewer and serves repeats from the cache', async () => {
    mocks.user = { userId: 'u9', username: 'pilot' };
    const first = await fetchAs(FULL);
    const second = await fetchAs(FULL);
    expect(first.body).toBe('marked');
    expect(second.body).toBe('marked');
    expect(mocks.watermarkPlate).toHaveBeenCalledTimes(1);
    expect(mocks.fetchChartGen).toHaveBeenCalledTimes(1);
  });

  it('never serves one viewer a plate marked for another', async () => {
    mocks.user = { userId: 'u1', username: 'alice' };
    await fetchAs(FULL);
    mocks.user = { userId: 'u2', username: 'bob' };
    await fetchAs(FULL);
    expect(mocks.watermarkPlate).toHaveBeenCalledTimes(2);
  });

  it('still checks login and plan before serving a cached plate', async () => {
    mocks.user = { userId: 'u9', username: 'pilot' };
    await fetchAs(FULL);
    mocks.hasPlan.mockResolvedValue(false);
    expect((await fetchAs(FULL)).status).toBe(402);
  });

  it('fails closed when a plate cannot be marked', async () => {
    mocks.watermarkPlate.mockRejectedValue(new Error('sharp failed'));
    const res = await fetchAs(FULL);
    expect(res.status).toBe(503);
  });

  it('leaves previews unmarked', async () => {
    await fetchAs(PREVIEW);
    expect(mocks.watermarkPlate).not.toHaveBeenCalled();
  });

  it('requires a login for full-size plates', async () => {
    mocks.user = undefined;
    expect((await fetchAs(FULL)).status).toBe(401);
  });

  it('requires a supporter plan for full-size plates', async () => {
    mocks.hasPlan.mockResolvedValue(false);
    expect((await fetchAs(FULL)).status).toBe(402);
  });

  it('caps how many full-size plates one account can pull per minute', async () => {
    mocks.user = { userId: 'bulk-user' };
    const statuses: number[] = [];
    for (let i = 0; i < 41; i++) statuses.push((await fetchAs(FULL)).status);
    expect(statuses.slice(0, 40).every((status) => status === 200)).toBe(true);
    expect(statuses[40]).toBe(429);
  });

  it('does not count previews against the cap', async () => {
    mocks.user = { userId: 'preview-user' };
    for (let i = 0; i < 45; i++) {
      expect((await fetchAs(PREVIEW)).status).toBe(200);
    }
  });
});
