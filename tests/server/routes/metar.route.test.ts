import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appRequest } from '../helpers/appRequest.js';

import metarRouter from '../../../server/routes/metar.js';

describe('GET /api/metar/:icao', () => {
  const app = express();
  app.use('/', metarRouter);

  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ raw: 'METAR EGLL' }]),
    } as Response);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns first METAR object when upstream returns json array', async () => {
    const res = await appRequest(app, 'GET', '/EGLL');

    expect(res.status).toBe(200);
    expect((res.body as { raw: string }).raw).toContain('EGLL');
  });
});
