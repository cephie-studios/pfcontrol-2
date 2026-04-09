import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => {
      const chain = {
        leftJoin: vi.fn(() => chain),
        select: vi.fn(() => chain),
        orderBy: vi.fn(() => ({ execute: mocks.execute })),
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

import { addFeedback, deleteFeedback, getAllFeedback } from '../../../server/db/feedback.js';

describe('getAllFeedback', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue([]);
  });

  it('returns rows from the database', async () => {
    mocks.execute.mockResolvedValue([{ id: 1, rating: 5 }]);

    const rows = await getAllFeedback();

    expect(rows).toHaveLength(1);
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
