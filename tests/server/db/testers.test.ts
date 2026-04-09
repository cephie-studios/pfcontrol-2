import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflict: vi.fn(() => ({
          returningAll: vi.fn(() => ({
            executeTakeFirst: mocks.executeTakeFirst,
          })),
        })),
      })),
    })),
    deleteFrom: vi.fn(() => ({
      where: vi.fn(() => ({
        returningAll: vi.fn(() => ({ executeTakeFirst: mocks.executeTakeFirst })),
      })),
    })),
    selectFrom: vi.fn(() => {
      const chain = {
        leftJoin: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        offset: vi.fn(() => ({ execute: mocks.execute })),
        select: vi.fn((arg: unknown) => {
          if (Array.isArray(arg)) {
            return { execute: mocks.execute };
          }
          return {
            where: vi.fn(() => ({ executeTakeFirst: mocks.executeTakeFirst })),
          };
        }),
      };
      return chain;
    }),
  },
  redisConnection: {},
}));

import {
  addTester,
  getTesterSettings,
  isTester,
  removeTester,
} from '../../../server/db/testers.js';

describe('addTester', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
  });

  it('upserts a tester row', async () => {
    mocks.executeTakeFirst.mockResolvedValue({ id: 1, user_id: 'u1' });

    const row = await addTester('u1', 'name', 'admin', 'Admin', '');

    expect(row?.user_id).toBe('u1');
  });
});

describe('removeTester', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
  });

  it('deletes by user id', async () => {
    mocks.executeTakeFirst.mockResolvedValue({ id: 1 });

    const row = await removeTester('u1');

    expect(row).toEqual({ id: 1 });
  });
});

describe('isTester', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
  });

  it('returns true when a row exists', async () => {
    mocks.executeTakeFirst.mockResolvedValue({ id: 1 });

    await expect(isTester('u1')).resolves.toBe(true);
  });

  it('returns false when no row', async () => {
    mocks.executeTakeFirst.mockResolvedValue(undefined);

    await expect(isTester('u1')).resolves.toBe(false);
  });
});

describe('getTesterSettings', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue([]);
  });

  it('defaults tester_gate_enabled when missing', async () => {
    const settings = await getTesterSettings();

    expect(settings.tester_gate_enabled).toBe(true);
  });
});
