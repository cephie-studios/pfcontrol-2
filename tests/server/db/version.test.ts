import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const mocks = vi.hoisted(() => ({
  executeTakeFirst: vi.fn(),
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => ({
      select: vi.fn(() => ({
        where: vi.fn(() => ({
          executeTakeFirst: mocks.executeTakeFirst,
        })),
      })),
    })),
  },
  redisConnection: mocks.redis,
}));

import { getAppVersion } from '../../../server/db/version.js';

describe('getAppVersion', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
    mocks.redis.get.mockReset();
    mocks.redis.set.mockReset();
  });

  it('returns normalized version data when a row exists', async () => {
    mocks.executeTakeFirst.mockResolvedValue({
      version: '1.2.3',
      updated_at: new Date('2024-06-01T12:00:00.000Z'),
      updated_by: 'admin',
    });

    const result = await getAppVersion();

    expect(result.version).toBe('1.2.3');
    expect(result.updated_by).toBe('admin');
    expect(typeof result.updated_at).toBe('string');
  });
});
