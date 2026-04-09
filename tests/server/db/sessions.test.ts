import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  executeTakeFirst: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => ({
      selectAll: vi.fn(() => ({
        where: vi.fn(() => ({ executeTakeFirst: mocks.executeTakeFirst })),
      })),
      select: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ execute: mocks.execute })),
        })),
      })),
    })),
  },
  redisConnection: {},
}));

import { getSessionById, getSessionsByUser } from '../../../server/db/sessions.js';

describe('getSessionById', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
  });

  it('returns null when not found', async () => {
    mocks.executeTakeFirst.mockResolvedValue(null);

    const session = await getSessionById('Ab12Cd34');

    expect(session).toBeNull();
  });

  it('returns session row', async () => {
    mocks.executeTakeFirst.mockResolvedValue({
      session_id: 'Ab12Cd34',
      airport_icao: 'EGLL',
    });

    const session = await getSessionById('Ab12Cd34');

    expect(session?.airport_icao).toBe('EGLL');
  });
});

describe('getSessionsByUser', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue([]);
  });

  it('returns sessions for user', async () => {
    mocks.execute.mockResolvedValue([{ session_id: 'Ab12Cd34' }]);

    const sessions = await getSessionsByUser('u1');

    expect(sessions).toHaveLength(1);
  });
});
