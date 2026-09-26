import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  offset: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => {
      const chain = {
        leftJoin: vi.fn(() => chain),
        where: mocks.where.mockImplementation(() => chain),
        select: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: mocks.limit.mockImplementation(() => chain),
        offset: mocks.offset.mockImplementation(() => chain),
        execute: mocks.execute,
        executeTakeFirst: mocks.executeTakeFirst,
      };
      return chain;
    }),
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        returningAll: vi.fn(() => ({ execute: mocks.execute })),
      })),
    })),
    deleteFrom: vi.fn(() => ({
      where: vi.fn(() => ({
        returningAll: vi.fn(() => ({ execute: mocks.execute })),
      })),
    })),
  },
  redisConnection: {},
}));

import {
  addFeedback,
  deleteFeedback,
  getFeedbackPaginated,
} from '../../../server/db/feedback.js';

describe('getFeedbackPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execute.mockResolvedValue([]);
    mocks.executeTakeFirst.mockResolvedValue({ total: 0 });
  });

  it('returns rows with pagination metadata', async () => {
    mocks.execute.mockResolvedValue([{ id: 1, rating: 5 }]);
    mocks.executeTakeFirst.mockResolvedValue({ total: '51' });

    const result = await getFeedbackPaginated({ page: 2, limit: 25 });

    expect(result.feedback).toEqual([{ id: 1, rating: 5 }]);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 25,
      total: 51,
      pages: 3,
    });
    expect(mocks.limit).toHaveBeenCalledWith(25);
    expect(mocks.offset).toHaveBeenCalledWith(25);
  });

  it('reports one page when there is no feedback', async () => {
    mocks.executeTakeFirst.mockResolvedValue(undefined);

    const result = await getFeedbackPaginated();

    expect(result.pagination).toEqual({
      page: 1,
      limit: 25,
      total: 0,
      pages: 1,
    });
    expect(mocks.where).not.toHaveBeenCalled();
  });

  it('applies search, rating and text filters', async () => {
    await getFeedbackPaginated({ search: '  hi ', rating: 4, withText: true });

    expect(mocks.where).toHaveBeenCalledTimes(3);
    expect(mocks.where).toHaveBeenCalledWith('feedback.rating', '=', 4);
  });
});

describe('addFeedback', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
  });

  it('inserts and returns created feedback', async () => {
    mocks.execute.mockResolvedValue([{ id: 2, rating: 4 }]);

    const row = await addFeedback({
      userId: 'u1',
      username: 'a',
      rating: 4,
    });

    expect(row).toEqual({ id: 2, rating: 4 });
  });
});

describe('deleteFeedback', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
  });

  it('deletes by id', async () => {
    mocks.execute.mockResolvedValue([{ id: 1 }]);

    const row = await deleteFeedback(1);

    expect(row).toEqual({ id: 1 });
  });
});
