import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertExecute: vi.fn(),
  updateExecute: vi.fn(),
  listExecute: vi.fn(),
  countExecute: vi.fn(),
  findExecute: vi.fn(),
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
      // dual-mode select: supports .execute() directly (count query)
      // or .orderBy().limit().offset().execute() (list query)
      const inner = {
        orderBy: vi.fn(),
        limit:   vi.fn(),
        offset:  vi.fn(),
        execute: mocks.countExecute,
      };
      inner.orderBy.mockReturnValue(inner);
      inner.limit.mockReturnValue(inner);
      inner.offset.mockReturnValue({ execute: mocks.listExecute });

      const chain = {
        leftJoin:         vi.fn(),
        selectAll:        vi.fn(),
        where:            vi.fn(),
        orderBy:          vi.fn(),
        limit:            vi.fn(),
        offset:           vi.fn(),
        executeTakeFirst: mocks.findExecute,
        select:           vi.fn().mockReturnValue(inner),
      };
      chain.leftJoin.mockReturnValue(chain);
      chain.selectAll.mockReturnValue(chain);
      chain.where.mockReturnValue(chain);
      chain.orderBy.mockReturnValue(chain);
      chain.limit.mockReturnValue(chain);
      chain.offset.mockReturnValue({ execute: mocks.listExecute });
      return chain;
    }),
  },
  redisConnection: {
    setex: vi.fn(),
    del: vi.fn(),
  },
}));

import {
  banUser,
  getAllBans,
  isIpBanned,
  isUserBanned,
  unbanUser,
} from '../../../server/db/ban.js';
import { redisConnection } from '../../../server/db/connection.js';

describe('banUser', () => {
  beforeEach(() => {
    mocks.insertExecute.mockClear();
    vi.mocked(redisConnection.setex).mockClear();
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
    vi.mocked(redisConnection.setex).mockResolvedValue('OK');
    await banUser({
      userId: 'u1',
      username: 'bad',
      reason: 'spam',
      bannedBy: 'admin',
    });
    expect(mocks.insertExecute).toHaveBeenCalled();
  });

  it('inserts a ban with ip address', async () => {
    mocks.insertExecute.mockResolvedValue(undefined);
    await banUser({
      ip: '1.2.3.4',
      username: 'bad',
      reason: 'abuse',
      bannedBy: 'admin',
    });
    expect(mocks.insertExecute).toHaveBeenCalled();
  });

  it('caches ban in redis when userId is provided', async () => {
    mocks.insertExecute.mockResolvedValue(undefined);
    vi.mocked(redisConnection.setex).mockResolvedValue('OK');
    await banUser({
      userId: 'u42',
      username: 'bad',
      reason: 'spam',
      bannedBy: 'admin',
    });
    expect(redisConnection.setex).toHaveBeenCalledWith('ban:u42', expect.any(Number), '1');
  });

  it('caches ip ban in redis when ip is provided', async () => {
    mocks.insertExecute.mockResolvedValue(undefined);
    vi.mocked(redisConnection.setex).mockResolvedValue('OK');
    await banUser({
      ip: '9.9.9.9',
      username: 'bad',
      reason: 'spam',
      bannedBy: 'admin',
    });
    expect(redisConnection.setex).toHaveBeenCalledWith('ban:ip:9.9.9.9', expect.any(Number), '1');
  });

  it('treats empty string expiresAt as undefined', async () => {
    mocks.insertExecute.mockResolvedValue(undefined);
    vi.mocked(redisConnection.setex).mockResolvedValue('OK');
    await expect(
      banUser({
        userId: 'u1',
        username: 'bad',
        reason: 'spam',
        bannedBy: 'admin',
        expiresAt: '',
      })
    ).resolves.toBeUndefined();
    expect(mocks.insertExecute).toHaveBeenCalled();
  });
});

describe('unbanUser', () => {
  beforeEach(() => {
    mocks.updateExecute.mockClear();
    mocks.updateExecute.mockResolvedValue(undefined);
    vi.mocked(redisConnection.del).mockClear();
    vi.mocked(redisConnection.del).mockResolvedValue(1);
  });

  it('updates bans to inactive', async () => {
    await unbanUser('u1');
    expect(mocks.updateExecute).toHaveBeenCalled();
  });

  it('clears the user and ip redis ban keys', async () => {
    await unbanUser('u1');
    expect(redisConnection.del).toHaveBeenCalledWith('ban:u1');
    expect(redisConnection.del).toHaveBeenCalledWith('ban:ip:u1');
    expect(redisConnection.del).toHaveBeenCalledTimes(2);
  });
});

describe('isUserBanned', () => {
  beforeEach(() => {
    mocks.findExecute.mockReset();
  });

  it('returns the ban record when user is banned', async () => {
    const ban = { id: 1, user_id: 'u1', active: true, banned_at: new Date() };
    mocks.findExecute.mockResolvedValue(ban);
    const result = await isUserBanned('u1');
    expect(result).toEqual(ban);
  });

  it('returns null when user is not banned', async () => {
    mocks.findExecute.mockResolvedValue(undefined);
    const result = await isUserBanned('u99');
    expect(result).toBeNull();
  });
});

describe('isIpBanned', () => {
  beforeEach(() => {
    mocks.findExecute.mockReset();
  });

  it('returns the ban record when ip is banned', async () => {
    const ban = { id: 2, ip_address: '1.2.3.4', active: true, banned_at: new Date() };
    mocks.findExecute.mockResolvedValue(ban);
    const result = await isIpBanned('1.2.3.4');
    expect(result).toEqual(ban);
  });

  it('returns null when ip is not banned', async () => {
    mocks.findExecute.mockResolvedValue(undefined);
    const result = await isIpBanned('9.9.9.9');
    expect(result).toBeNull();
  });
});

describe('getAllBans', () => {
  beforeEach(() => {
    mocks.listExecute.mockReset();
    mocks.countExecute.mockReset();
    mocks.listExecute.mockResolvedValue([]);
    mocks.countExecute.mockResolvedValue([{ count: '0' }]);
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
    mocks.countExecute.mockResolvedValue([{ count: '2' }]);
    const out = await getAllBans(1, 50);
    expect(out.bans).toHaveLength(1);
    expect(out.pagination.total).toBe(2);
    expect(out.pagination.page).toBe(1);
  });

  it('returns empty list when no bans exist', async () => {
    const out = await getAllBans(1, 50);
    expect(out.bans).toHaveLength(0);
    expect(out.pagination.total).toBe(0);
    expect(out.pagination.pages).toBe(0);
  });

  it('calculates correct page count from total', async () => {
    mocks.countExecute.mockResolvedValue([{ count: '103' }]);
    const out = await getAllBans(1, 50);
    expect(out.pagination.total).toBe(103);
    expect(out.pagination.pages).toBe(3);
    expect(out.pagination.limit).toBe(50);
  });
});
