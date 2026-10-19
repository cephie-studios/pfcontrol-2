import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => {
      const chain = {
        selectAll: vi.fn(() => chain),
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({ execute: mocks.execute })),
        })),
      };
      return chain;
    }),
  },
  redisConnection: {},
}));

import { getUserNotifications } from '../../../server/db/userNotifications.js';

describe('getUserNotifications', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue([]);
  });

  it('returns notifications for user', async () => {
    mocks.execute.mockResolvedValue([{ id: 1, read: false }]);

    const rows = await getUserNotifications('u1');

    expect(rows).toHaveLength(1);
  });

  it('supports unreadOnly filter', async () => {
    mocks.execute.mockResolvedValue([]);

    await getUserNotifications('u1', true);

    expect(mocks.execute).toHaveBeenCalled();
  });
});
