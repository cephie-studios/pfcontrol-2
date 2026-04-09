import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRequest } from '../helpers/appRequest.js';

vi.mock('../../../server/db/users.js', () => ({
  getUserByUsername: vi.fn(),
}));

vi.mock('../../../server/db/ratings.js', () => ({
  getControllerRatingStats: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => {
  const chain: Record<string, unknown> = {};
  chain.execute = vi.fn().mockResolvedValue([]);
  chain.innerJoin = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  return {
    mainDb: {
      selectFrom: vi.fn(() => chain),
    },
    redisConnection: {},
  };
});

import { getControllerRatingStats } from '../../../server/db/ratings.js';
import { getUserByUsername } from '../../../server/db/users.js';
import pilotRouter from '../../../server/routes/pilot.js';

describe('GET /api/pilot/:username', () => {
  const app = express();
  app.use('/', pilotRouter);

  beforeEach(() => {
    vi.mocked(getUserByUsername).mockReset();
    vi.mocked(getControllerRatingStats).mockReset();
  });

  it('returns 404 when user is unknown', async () => {
    vi.mocked(getUserByUsername).mockResolvedValue(null);

    const res = await appRequest(app, 'GET', '/nobody');

    expect(res.status).toBe(404);
  });

  it('returns profile json when user exists', async () => {
    vi.mocked(getUserByUsername).mockResolvedValue({
      id: 'u1',
      username: 'pilot',
      discriminator: '0',
      avatar: null,
      created_at: new Date(),
      roblox_username: null,
      roblox_user_id: null,
      vatsim_cid: null,
      vatsim_rating_short: null,
      vatsim_rating_long: null,
      statistics: {},
      settings: {
        displayControllerStatsOnProfile: true,
        displayPilotStatsOnProfile: true,
        displayControllerRatingOnProfile: true,
        displayLinkedAccountsOnProfile: true,
        displayBackgroundOnProfile: true,
        bio: '',
        backgroundImage: null,
      },
    } as never);
    vi.mocked(getControllerRatingStats).mockResolvedValue({
      averageRating: 0,
      ratingCount: 0,
    });

    const res = await appRequest(app, 'GET', '/pilot');

    expect(res.status).toBe(200);
    expect((res.body as { user: { username: string } }).user.username).toBe(
      'pilot'
    );
  });
});
