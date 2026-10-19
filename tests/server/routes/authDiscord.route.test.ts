import http from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

vi.hoisted(() => {
  process.env.DISCORD_CLIENT_ID = 'test-client';
  process.env.DISCORD_REDIRECT_URI =
    'http://localhost/api/auth/discord/callback';
  process.env.FRONTEND_URL = 'http://frontend.test';
});

vi.mock('../../../server/db/connection.js', () => ({
  redisConnection: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));
vi.mock('../../../server/db/users.js', () => ({}));
vi.mock('../../../server/db/statistics.js', () => ({}));
vi.mock('../../../server/db/ban.js', () => ({}));
vi.mock('../../../server/db/testers.js', () => ({}));
vi.mock('../../../server/db/vpnExceptions.js', () => ({}));
vi.mock('../../../server/db/leaderboard.js', () => ({ STATS_KEYS: {} }));
vi.mock('../../../server/services/vatsimRating.js', () => ({
  VATSIM_RATINGS: {},
}));
vi.mock('../../../server/utils/posthog.js', () => ({
  default: { identify: vi.fn() },
  capture: vi.fn(),
}));
vi.mock('../../../server/middleware/security.js', () => ({
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import authRouter from '../../../server/routes/auth.js';

function encodeState(state: object): string {
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

function decodeState(raw: string | null): Record<string, unknown> {
  return JSON.parse(Buffer.from(raw ?? '', 'base64').toString());
}

describe('Discord OAuth routes', () => {
  const app = express();
  app.use('/api/auth', authRouter);
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const addr = server.address() as { port: number };
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(() => {
    server.close();
  });

  async function location(path: string): Promise<URL> {
    const res = await fetch(base + path, { redirect: 'manual' });
    expect(res.status).toBe(302);
    return new URL(res.headers.get('location') ?? '', base);
  }

  it('sends prompt=none by default and keeps the callback in state', async () => {
    const url = await location(
      `/api/auth/discord?callback=${encodeURIComponent('/acars/s/f?acars_token=t')}`
    );
    expect(url.origin + url.pathname).toBe(
      'https://discord.com/api/oauth2/authorize'
    );
    expect(url.searchParams.get('prompt')).toBe('none');
    expect(decodeState(url.searchParams.get('state'))).toEqual({
      callback: '/acars/s/f?acars_token=t',
      consent: false,
    });
  });

  it('sends prompt=consent when consent=1', async () => {
    const url = await location('/api/auth/discord?consent=1');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(decodeState(url.searchParams.get('state')).consent).toBe(true);
  });

  it('retries once with consent when the silent attempt is rejected', async () => {
    const state = encodeState({ callback: '/submit/x', consent: false });
    const url = await location(
      `/api/auth/discord/callback?error=consent_required&state=${encodeURIComponent(state)}`
    );
    expect(url.pathname).toBe('/api/auth/discord');
    expect(url.searchParams.get('consent')).toBe('1');
    expect(url.searchParams.get('callback')).toBe('/submit/x');
  });

  it('redirects to /login with the error after the consent attempt fails', async () => {
    const state = encodeState({ callback: '/submit/x', consent: true });
    const url = await location(
      `/api/auth/discord/callback?error=access_denied&state=${encodeURIComponent(state)}`
    );
    expect(url.origin + url.pathname).toBe('http://frontend.test/login');
    expect(url.searchParams.get('error')).toBe('access_denied');
    expect(url.searchParams.get('callback')).toBe('/submit/x');
  });

  it('maps unknown Discord errors to discord_error', async () => {
    const state = encodeState({ consent: true });
    const url = await location(
      `/api/auth/discord/callback?error=something_else&state=${encodeURIComponent(state)}`
    );
    expect(url.searchParams.get('error')).toBe('discord_error');
    expect(url.searchParams.get('callback')).toBeNull();
  });

  it('redirects to /login when the code is missing', async () => {
    const url = await location('/api/auth/discord/callback');
    expect(url.origin + url.pathname).toBe('http://frontend.test/login');
    expect(url.searchParams.get('error')).toBe('missing_code');
  });
});
