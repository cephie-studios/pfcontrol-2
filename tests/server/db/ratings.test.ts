import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({ execute: mocks.execute })),
    })),
    selectFrom: vi.fn(() => ({
      where: vi.fn(() => ({
        select: vi.fn(() => ({
          executeTakeFirst: mocks.executeTakeFirst,
        })),
      })),
    })),
  },
  redisConnection: {},
}));

import { addControllerRating, getControllerRatingStats } from '../../../server/db/ratings.js';

describe('addControllerRating', () => {
  beforeEach(() => {
    mocks.execute.mockClear();
    mocks.execute.mockResolvedValue(undefined);
  });

  it('inserts a rating row', async () => {
    await addControllerRating('c1', 'p1', 5, 'f1');
    expect(mocks.execute).toHaveBeenCalled();
  });
});

describe('getControllerRatingStats', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
  });

  it('returns averages and counts', async () => {
    mocks.executeTakeFirst.mockResolvedValue({
      averageRating: '4.5',
      ratingCount: '10',
    });

    const stats = await getControllerRatingStats('c1');

    expect(stats.averageRating).toBe(4.5);
    expect(stats.ratingCount).toBe(10);
  });

  it('returns zeros when no rows', async () => {
    mocks.executeTakeFirst.mockResolvedValue(undefined);

    const stats = await getControllerRatingStats('c1');

    expect(stats.averageRating).toBe(0);
    expect(stats.ratingCount).toBe(0);
  });
});
