import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertExecute: vi.fn(),
  updateExecute: vi.fn(),
  listExecute: vi.fn(),
  countExecute: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({ execute: mocks.insertExecute })),
    })),
    updateTable: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          where: vi.fn(() => ({ execute: mocks.updateExecute })),
        })),
      })),
    })),
    selectFrom: vi.fn(() => {
      const chain = {
        selectAll: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        offset: vi.fn(() => ({ execute: mocks.listExecute })),
        select: vi.fn(() => ({ execute: mocks.countExecute })),
      };
      return chain;
    }),
  },
  redisConnection: {},
}));

import { banUser, getAllBans, unbanUser } from '../../../server/db/ban.js';

describe('banUser', () => {
  beforeEach(() => {
    mocks.insertExecute.mockClear();
  });

  it('throws when neither userId nor ip is provided', async () => {
    await expect(
      banUser({
        username: 'x',
        reason: 'r',
        bannedBy: 'admin',
      })
    ).rejects.toThrow('Either userId or ip must be provided');
  });

  it('inserts a ban with user id', async () => {
    mocks.insertExecute.mockResolvedValue(undefined);
    await banUser({
      userId: 'u1',
      username: 'bad',
      reason: 'spam',
      bannedBy: 'admin',
    });
    expect(mocks.insertExecute).toHaveBeenCalled();
  });
});

describe('unbanUser', () => {
  beforeEach(() => {
    mocks.updateExecute.mockClear();
    mocks.updateExecute.mockResolvedValue(undefined);
  });

  it('updates bans to inactive', async () => {
    await unbanUser('u1');
    expect(mocks.updateExecute).toHaveBeenCalled();
  });
});

describe('getAllBans', () => {
  beforeEach(() => {
    mocks.listExecute.mockReset();
    mocks.countExecute.mockReset();
    mocks.listExecute.mockResolvedValue([]);
    mocks.countExecute.mockResolvedValue([{ count: '2' }]);
  });

  it('returns bans and pagination', async () => {
    mocks.listExecute.mockResolvedValue([
      {
        id: 1,
        user_id: 'a',
        active: true,
        banned_at: new Date(),
      },
    ]);
    const out = await getAllBans(1, 50);
    expect(out.bans).toHaveLength(1);
    expect(out.pagination.total).toBe(2);
    expect(out.pagination.page).toBe(1);
  });
});
