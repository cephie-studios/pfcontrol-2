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

const fixture = vi.hoisted(() => ({
  // 20-unit legs sit inside findPath's [7, 35] range, while ALPHA->BRAVO
  waypoints: [
    { name: 'AAAA', x: 0, y: 0, type: 'AIRPORT' },
    { name: 'ALPHA', x: 0, y: 20, type: 'FIX' },
    { name: 'MIDDL', x: 0, y: 40, type: 'FIX' },
    { name: 'BRAVO', x: 0, y: 60, type: 'FIX' },
    { name: 'BBBB', x: 0, y: 80, type: 'AIRPORT' },
    // An isolated pair with no fixes in range of either end.
    { name: 'CCCC', x: 200, y: 200, type: 'AIRPORT' },
    { name: 'DDDD', x: 205, y: 200, type: 'AIRPORT' },
  ],
  airports: [
    {
      icao: 'AAAA',
      runways: ['26', '08'],
      departures: {
        '26': { BBBB: 'ALPHA1X' },
        '08': { BBBB: 'RADAR VECTORS' },
      },
      arrivals: { '26': {}, '08': {} },
    },
    {
      icao: 'BBBB',
      runways: ['22', '04'],
      departures: { '22': {}, '04': {} },
      arrivals: { '22': { AAAA: 'BRAVO1V' }, '04': { AAAA: 'RADAR VECTORS' } },
    },
    {
      icao: 'CCCC',
      runways: ['09'],
      departures: { '09': {} },
      arrivals: { '09': {} },
    },
    {
      icao: 'DDDD',
      runways: ['09'],
      departures: { '09': {} },
      arrivals: { '09': {} },
    },
  ],
}));

vi.mock('../../../server/utils/getData.js', () => ({
  getAirportData: () => fixture.airports,
  getWaypointData: () => fixture.waypoints,
  getAircraftData: () => [],
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

  // Runway 08 departs AAAA on radar vectors, runway 26 flies the ALPHA1X SID.
  // Radar vectors means no published SID off that runway, not that the flight
  // has no route — the enroute segment and the STAR are unaffected.
  it('routes waypoints and the STAR when the SID is RADAR VECTORS', async () => {
    const res = await get('from=AAAA&to=BBBB&runway=08');
    const body = res.body as RouteBody;

    expect(res.status).toBe(200);
    expect(body.sid).toBeUndefined();
    expect(body.star).toBe('BRAVO1V');
    expect(body.route).toBe('AAAA ALPHA MIDDL BRAVO BRAVO1V BBBB');
    expect(body.distance).toBeGreaterThan(0);
  });

  it('includes the SID when the runway has a published procedure', async () => {
    const res = await get('from=AAAA&to=BBBB&runway=26');
    const body = res.body as RouteBody;

    expect(res.status).toBe(200);
    expect(body.sid).toBe('ALPHA1X');
    expect(body.star).toBe('BRAVO1V');
    expect(body.route).toBe('AAAA ALPHA1X ALPHA MIDDL BRAVO BRAVO1V BBBB');
  });

  it('falls back to the first departure runway key when none is given', async () => {
    const res = await get('from=AAAA&to=BBBB');
    const body = res.body as RouteBody;

    expect(res.status).toBe(200);
    expect(body.sid).toBe('ALPHA1X');
    expect(body.route.split(' ').length).toBeGreaterThan(2);
  });

  it('routes direct with a real distance when no path exists', async () => {
    const res = await get('from=CCCC&to=DDDD&runway=09');
    const body = res.body as RouteBody;

    expect(res.status).toBe(200);
    expect(body.route).toBe('CCCC DDDD');
    expect(body.distance).toBeGreaterThan(0);
  });

  it('404s when an airport is not in the waypoint graph', async () => {
    const res = await get('from=AAAA&to=ZZZZ');

    expect(res.status).toBe(404);
  });

  it('400s when from or to is missing', async () => {
    const res = await get('from=AAAA');

    expect(res.status).toBe(400);
  });
});
