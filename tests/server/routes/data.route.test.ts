import express from 'express';
import { describe, expect, it, vi } from 'vitest';

import { appRequest } from '../helpers/appRequest.js';

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {},
  redisConnection: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
  },
}));

import dataRouter from '../../../server/routes/data.js';

describe('GET /api/data/airports', () => {
  const app = express();
  app.use('/', dataRouter);

  it('returns airport json when data files exist', async () => {
    const res = await appRequest(app, 'GET', '/airports');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
