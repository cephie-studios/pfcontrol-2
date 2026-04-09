import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  redis: {
    del: vi.fn(),
    zadd: vi.fn(),
    zrevrank: vi.fn(),
  },
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => ({
      select: vi.fn(() => ({ execute: mocks.execute })),
    })),
  },
  redisConnection: mocks.redis,
}));

vi.mock('../../../server/db/users.js', () => ({
  getUserById: vi.fn(),
}));

import { getUserRank, updateLeaderboard } from '../../../server/db/leaderboard.js';

describe('updateLeaderboard', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.redis.del.mockReset();
    mocks.redis.zadd.mockReset();
    mocks.execute.mockResolvedValue([]);
  });

  it('clears redis keys when there are no users', async () => {
    await updateLeaderboard();
    expect(mocks.redis.del).toHaveBeenCalled();
  });
});

describe('getUserRank', () => {
  beforeEach(() => {
    mocks.redis.zrevrank.mockReset();
  });

  it('returns 1-based rank', async () => {
    mocks.redis.zrevrank.mockResolvedValue(0);

    const rank = await getUserRank('u1', 'total_sessions_created');

    expect(rank).toBe(1);
  });

  it('returns null when user not in leaderboard', async () => {
    mocks.redis.zrevrank.mockResolvedValue(null);

    const rank = await getUserRank('u1', 'total_sessions_created');

    expect(rank).toBeNull();
  });
});
