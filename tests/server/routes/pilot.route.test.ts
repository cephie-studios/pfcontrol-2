import express from 'express';
import cookieParser from 'cookie-parser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRequest } from '../helpers/appRequest.js';

vi.mock('../../../server/services/publicPilotProfile.js', () => ({
  getPublicPilotProfile: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {},
  redisConnection: {},
}));

import { getPublicPilotProfile } from '../../../server/services/publicPilotProfile.js';
import pilotRouter from '../../../server/routes/pilot.js';

describe('GET /api/pilot/:username', () => {
  const app = express();
  // Mirrors main.ts — optionalAuth reads req.cookies, which is undefined
  // without this and makes every request fail with a 500.
  app.use(cookieParser());
  app.use('/', pilotRouter);

  beforeEach(() => {
    vi.mocked(getPublicPilotProfile).mockReset();
  });

  it('returns 404 when user is unknown', async () => {
    vi.mocked(getPublicPilotProfile).mockResolvedValue(null);

    const res = await appRequest(app, 'GET', '/nobody');

    expect(res.status).toBe(404);
    expect(getPublicPilotProfile).toHaveBeenCalledWith('nobody', undefined);
  });

  it('returns profile json when user exists', async () => {
    vi.mocked(getPublicPilotProfile).mockResolvedValue({
      user: {
        id: 'u1',
        username: 'pilot',
        discriminator: '0',
        avatar: null,
      },
      roles: [],
    } as never);

    const res = await appRequest(app, 'GET', '/pilot');

    expect(res.status).toBe(200);
    expect((res.body as { user: { username: string } }).user.username).toBe(
      'pilot'
    );
  });

  it('returns 500 when the profile lookup throws', async () => {
    vi.mocked(getPublicPilotProfile).mockRejectedValue(new Error('db down'));

    const res = await appRequest(app, 'GET', '/pilot');

    expect(res.status).toBe(500);
  });
});
