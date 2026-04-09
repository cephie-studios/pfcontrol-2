import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redisDel: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {},
  redisConnection: {
    get: vi.fn(),
    set: vi.fn(),
    del: mocks.redisDel,
  },
}));

import { invalidateUserCache } from '../../../server/db/users.js';

describe('invalidateUserCache', () => {
  beforeEach(() => {
    mocks.redisDel.mockReset();
    mocks.redisDel.mockResolvedValue(1);
  });

  it('deletes the user cache key', async () => {
    await invalidateUserCache('user-123');

    expect(mocks.redisDel).toHaveBeenCalledWith('user:user-123');
  });
});
