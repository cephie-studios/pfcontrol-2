import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => {
      const chain = {
        selectAll: vi.fn(() => chain),
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => ({ execute: mocks.execute })),
      };
      return chain;
    }),
  },
  redisConnection: {},
}));

import { getChatMessages } from '../../../server/db/chats.js';

describe('getChatMessages', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue([]);
  });

  it('returns empty list when no rows', async () => {
    const messages = await getChatMessages('Ab12Cd34');

    expect(messages).toEqual([]);
  });
});
