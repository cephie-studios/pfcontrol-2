import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const mocks = vi.hoisted(() => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {},
  redisConnection: mocks.redis,
}));

import { getTotalStatistics } from '../../../server/db/admin.js';

describe('getTotalStatistics', () => {
  beforeEach(() => {
    mocks.redis.get.mockReset();
  });

  it('returns cached payload when redis has admin:total_stats', async () => {
    const payload = {
      total_logins: 10,
      total_sessions: 20,
      total_flights: 30,
      total_users: 40,
    };
    mocks.redis.get.mockResolvedValue(JSON.stringify(payload));

    const stats = await getTotalStatistics();

    expect(stats).toEqual(payload);
  });
});
