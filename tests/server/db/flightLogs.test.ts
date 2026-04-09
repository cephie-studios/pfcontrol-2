import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  executeTakeFirst: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => ({
      select: vi.fn(() => ({
        executeTakeFirst: mocks.executeTakeFirst,
      })),
    })),
  },
  redisConnection: {},
}));

import { getFlightLogsCount } from '../../../server/db/flightLogs.js';

describe('getFlightLogsCount', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
  });

  it('returns numeric count', async () => {
    mocks.executeTakeFirst.mockResolvedValue({ count: '42' });

    const n = await getFlightLogsCount();

    expect(n).toBe(42);
  });

  it('returns 0 when missing', async () => {
    mocks.executeTakeFirst.mockResolvedValue(undefined);

    const n = await getFlightLogsCount();

    expect(n).toBe(0);
  });
});
