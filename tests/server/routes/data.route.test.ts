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

describe('GET /api/data/findRoute', () => {
  const app = express();
  app.use('/', dataRouter);

  type RouteBody = {
    route: string;
    distance: number;
    sid?: string;
    star?: string;
  };

  const get = (query: string) => appRequest(app, 'GET', `/findRoute?${query}`);

  // EFKT departures: runway 16 to LCLK is 'RADAR VECTORS', runway 34 is
  // 'ROSE3C'. Radar vectors means no published SID off that runway, not that
  // the flight has no route.
  it('routes waypoints and the STAR when the SID is RADAR VECTORS', async () => {
    const res = await get('from=EFKT&to=LCLK&runway=16');
    const body = res.body as RouteBody;

    expect(res.status).toBe(200);
    expect(body.sid).toBeUndefined();
    expect(body.star).toBe('KRASI1V');
    expect(body.route).toBe('EFKT LIMA BELOW MORSS KRASI KRASI1V LCLK');
    expect(body.distance).toBeGreaterThan(0);
  });

  it('falls back to the first departure runway key and routes', async () => {
    const res = await get('from=EFKT&to=LCLK');
    const body = res.body as RouteBody;

    expect(res.status).toBe(200);
    expect(body.route.split(' ').length).toBeGreaterThan(2);
  });

  it('includes the SID when the runway has a published procedure', async () => {
    const res = await get('from=EFKT&to=LCLK&runway=34');
    const body = res.body as RouteBody;

    expect(res.status).toBe(200);
    expect(body.sid).toBe('ROSE3C');
    expect(body.route).toBe('EFKT ROSE3C ROSE BELOW MORSS KRASI KRASI1V LCLK');
  });

  // MDPC and MDAB are ~10 units apart, too close to fit two waypoints.
  it('routes direct with a real distance when no path exists', async () => {
    const res = await get('from=MDPC&to=MDAB&runway=08');
    const body = res.body as RouteBody;

    expect(res.status).toBe(200);
    expect(body.route).toBe('MDPC MDAB');
    expect(body.distance).toBeGreaterThan(0);
  });

  it('404s when an airport is not in the waypoint graph', async () => {
    const res = await get('from=EFKT&to=ZZZZ');

    expect(res.status).toBe(404);
  });

  it('400s when from or to is missing', async () => {
    const res = await get('from=EFKT');

    expect(res.status).toBe(400);
  });
});
