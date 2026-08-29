import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appRequest } from '../helpers/appRequest.js';

// cloudflareTurn reads its key material at module load, so seed the env before
// the import graph is evaluated.
vi.hoisted(() => {
  process.env.CF_TURN_TOKEN = 'test-key-id';
  process.env.CF_API_TOKEN = 'test-api-token';
});

vi.mock('../../../server/middleware/auth.js', () => ({
  default: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: 'user-1' } as Request['user'];
    next();
  },
}));

// Pass-through limiter so repeated test requests are not throttled.
vi.mock('../../../server/middleware/rateLimiting.js', () => ({
  turnCredentialLimiter: (_req: Request, _res: Response, next: NextFunction) =>
    next(),
}));

import turnRouter from '../../../server/routes/turn.js';
import { clearTurnCredentialCacheForTests } from '../../../server/utils/cloudflareTurn.js';

const TURN_ENTRY = {
  urls: [
    'turn:turn.cloudflare.com:3478?transport=udp',
    'turns:turn.cloudflare.com:5349?transport=tcp',
  ],
  username: 'test-username',
  credential: 'test-credential',
};

type TurnBody = {
  iceServers: { urls: string[]; username?: string; credential?: string }[];
  turnAvailable: boolean;
};

describe('GET /api/turn/credentials', () => {
  const app = express();
  app.use('/', turnRouter);

  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearTurnCredentialCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns ICE servers when Cloudflare responds with an array', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }, TURN_ENTRY],
        }),
    }) as unknown as typeof fetch;

    const res = await appRequest(app, 'GET', '/credentials');
    const body = res.body as TurnBody;

    expect(res.status).toBe(200);
    expect(body.turnAvailable).toBe(true);
    expect(body.iceServers).toHaveLength(2);
    expect(body.iceServers[1].credential).toBe('test-credential');
  });

  it('normalizes a single ICE server object into an array', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ iceServers: TURN_ENTRY }),
    }) as unknown as typeof fetch;

    const res = await appRequest(app, 'GET', '/credentials');
    const body = res.body as TurnBody;

    expect(res.status).toBe(200);
    expect(body.turnAvailable).toBe(true);
    expect(body.iceServers).toHaveLength(1);
    expect(body.iceServers[0].username).toBe('test-username');
  });

  it('reuses the cached credential instead of re-minting per request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ iceServers: TURN_ENTRY }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await appRequest(app, 'GET', '/credentials');
    await appRequest(app, 'GET', '/credentials');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Voice chat must keep working over STUN when TURN cannot be minted —
  // a relay outage should degrade connectivity, not break joining entirely.
  it('degrades to STUN-only when Cloudflare returns an error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('bad token'),
    }) as unknown as typeof fetch;

    const res = await appRequest(app, 'GET', '/credentials');
    const body = res.body as TurnBody;

    expect(res.status).toBe(200);
    expect(body.turnAvailable).toBe(false);
    expect(body.iceServers).toEqual([]);
  });

  it('degrades to STUN-only when the Cloudflare request throws', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const res = await appRequest(app, 'GET', '/credentials');
    const body = res.body as TurnBody;

    expect(res.status).toBe(200);
    expect(body.turnAvailable).toBe(false);
  });

  it('degrades to STUN-only on an unexpected response shape', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ unexpected: true }),
    }) as unknown as typeof fetch;

    const res = await appRequest(app, 'GET', '/credentials');
    const body = res.body as TurnBody;

    expect(res.status).toBe(200);
    expect(body.turnAvailable).toBe(false);
  });

  it('never exposes the long-term TURN key to the client', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ iceServers: TURN_ENTRY }),
    }) as unknown as typeof fetch;

    const res = await appRequest(app, 'GET', '/credentials');
    const serialized = JSON.stringify(res.body);

    expect(serialized).not.toContain('test-api-token');
    expect(serialized).not.toContain('test-key-id');
  });
});
