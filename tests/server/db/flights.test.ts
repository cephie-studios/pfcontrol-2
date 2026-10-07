import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

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

import {
  dropUnchangedFlightFields,
  getFlightById,
} from '../../../server/db/flights.js';

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

describe('dropUnchangedFlightFields', () => {
  const current = {
    route: 'DCT ABC',
    remark: null,
    clearedfl: '050',
    departure: 'EGKK',
    clearance: 'false',
    req_at: new Date('2026-05-01T10:00:00.000Z'),
  };

  it('drops fields that match the stored value', () => {
    expect(
      dropUnchangedFlightFields(current, {
        route: 'DCT ABC',
        remark: '',
        clearedFL: '050',
        departure: 'egkk',
        clearance: false,
        req_at: '2026-05-01T10:00:00.000Z',
      })
    ).toEqual({});
  });

  it('keeps fields that differ or are not columns', () => {
    expect(
      dropUnchangedFlightFields(current, {
        route: 'DCT XYZ',
        clearedFL: '060',
        clearance: true,
        remark: 'hi',
        bogus: 1,
      })
    ).toEqual({
      route: 'DCT XYZ',
      clearedFL: '060',
      clearance: true,
      remark: 'hi',
      bogus: 1,
    });
  });

  it('returns updates untouched when the flight is missing', () => {
    expect(dropUnchangedFlightFields(undefined, { route: '' })).toEqual({
      route: '',
    });
  });
});
