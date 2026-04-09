import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  executeTakeFirst: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => ({
      selectAll: vi.fn(() => {
        const chain = {
          where: vi.fn(() => chain),
          executeTakeFirst: mocks.executeTakeFirst,
        };
        return chain;
      }),
    })),
  },
  redisConnection: {},
}));

import { getFlightById } from '../../../server/db/flights.js';

describe('getFlightById', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
  });

  it('returns null when not found', async () => {
    mocks.executeTakeFirst.mockResolvedValue(null);

    const flight = await getFlightById('Ab12Cd34', 'f1');

    expect(flight).toBeNull();
  });
});
