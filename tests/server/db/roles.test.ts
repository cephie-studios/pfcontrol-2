import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => {
      const chain = {
        leftJoin: vi.fn(() => chain),
        select: vi.fn(() => chain),
        groupBy: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        selectAll: vi.fn(() => ({
          where: vi.fn(() => ({ executeTakeFirst: mocks.executeTakeFirst })),
        })),
        execute: mocks.execute,
      };
      return chain;
    }),
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        returningAll: vi.fn(() => ({ executeTakeFirst: mocks.executeTakeFirst })),
      })),
    })),
    updateTable: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returningAll: vi.fn(() => ({ executeTakeFirst: mocks.executeTakeFirst })),
        })),
      })),
    })),
    deleteFrom: vi.fn(() => ({
      where: vi.fn(() => ({ executeTakeFirst: mocks.executeTakeFirst })),
    })),
  },
  redisConnection: {},
}));

import { createRole, getAllRoles, getRoleById } from '../../../server/db/roles.js';

describe('getRoleById', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
  });

  it('returns null when missing', async () => {
    mocks.executeTakeFirst.mockResolvedValue(null);

    const role = await getRoleById(999);

    expect(role).toBeNull();
  });

  it('returns role row', async () => {
    mocks.executeTakeFirst.mockResolvedValue({ id: 1, name: 'Admin' });

    const role = await getRoleById(1);

    expect(role?.name).toBe('Admin');
  });
});

describe('getAllRoles', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue([]);
  });

  it('returns role list', async () => {
    mocks.execute.mockResolvedValue([{ id: 1, name: 'Mod' }]);

    const roles = await getAllRoles();

    expect(roles).toHaveLength(1);
  });
});

describe('createRole', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
  });

  it('inserts a role', async () => {
    mocks.executeTakeFirst.mockResolvedValue({ id: 2, name: 'New' });

    const role = await createRole({
      name: 'New',
      permissions: { a: true },
    });

    expect(role?.name).toBe('New');
  });
});
