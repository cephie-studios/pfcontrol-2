import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const mocks = vi.hoisted(() => ({
  executeTakeFirst: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => ({
      selectAll: vi.fn(() => ({
        where: vi.fn(() => ({ executeTakeFirst: mocks.executeTakeFirst })),
      })),
    })),
  },
  redisConnection: {},
}));

vi.mock('../../../server/utils/encryption.js', () => ({
  decrypt: vi.fn((x: unknown) => x),
}));

import { getApiLogById } from '../../../server/db/apiLogs.js';

describe('getApiLogById', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
  });

  it('returns null when not found', async () => {
    mocks.executeTakeFirst.mockResolvedValue(null);

    const log = await getApiLogById(123);

    expect(log).toBeNull();
  });
});
