import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => {
      const chain = {
        selectAll: vi.fn(() => chain),
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        executeTakeFirst: mocks.executeTakeFirst,
        execute: mocks.execute,
      };
      return chain;
    }),
  },
  redisConnection: mocks.redis,
}));

import {
  getActiveUpdateModal,
  getAllUpdateModals,
  getUpdateModalById,
} from '../../../server/db/updateModals.js';

describe('getActiveUpdateModal', () => {
  beforeEach(() => {
    mocks.redis.get.mockReset();
    mocks.redis.set.mockReset();
    mocks.executeTakeFirst.mockReset();
  });

  it('returns parsed value from redis when cached', async () => {
    const payload = { id: 1, title: 'Hi' };
    mocks.redis.get.mockResolvedValue(JSON.stringify(payload));

    const result = await getActiveUpdateModal();

    expect(result).toEqual(payload);
    expect(mocks.executeTakeFirst).not.toHaveBeenCalled();
  });

  it('loads from database when redis is empty', async () => {
    mocks.redis.get.mockResolvedValue(null);
    mocks.executeTakeFirst.mockResolvedValue(null);

    const result = await getActiveUpdateModal();

    expect(result).toBeNull();
    expect(mocks.redis.set).toHaveBeenCalled();
  });
});

describe('getAllUpdateModals', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue([]);
  });

  it('returns modal rows', async () => {
    const rows = [{ id: 1, title: 'A' }];
    mocks.execute.mockResolvedValue(rows);

    const result = await getAllUpdateModals();

    expect(result).toEqual(rows);
  });
});

describe('getUpdateModalById', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
  });

  it('returns null when not found', async () => {
    mocks.executeTakeFirst.mockResolvedValue(null);

    const result = await getUpdateModalById(999);

    expect(result).toBeNull();
  });
});
