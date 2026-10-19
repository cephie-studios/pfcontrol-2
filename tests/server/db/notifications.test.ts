import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: vi.fn(() => {
      const chain = {
        selectAll: vi.fn(() => chain),
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => ({ execute: mocks.execute })),
      };
      return chain;
    }),
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        returningAll: vi.fn(() => ({ execute: mocks.execute })),
      })),
    })),
    updateTable: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returningAll: vi.fn(() => ({ execute: mocks.execute })),
        })),
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

import {
  addNotification,
  deleteNotification,
  getActiveNotifications,
  getAllNotifications,
  updateNotification,
} from '../../../server/db/notifications.js';

describe('getAllNotifications', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue([]);
  });

  it('returns notifications', async () => {
    mocks.execute.mockResolvedValue([{ id: 1, text: 'x' }]);

    const rows = await getAllNotifications();

    expect(rows).toHaveLength(1);
  });
});

describe('getActiveNotifications', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue([]);
  });

  it('filters to show = true', async () => {
    await getActiveNotifications();
    expect(mocks.execute).toHaveBeenCalled();
  });
});

describe('addNotification', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
  });

  it('inserts a row', async () => {
    mocks.execute.mockResolvedValue([{ id: 3 }]);

    const row = await addNotification({ type: 'info', text: 'hello' });

    expect(row).toEqual({ id: 3 });
  });
});

describe('updateNotification', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
  });

  it('updates fields', async () => {
    mocks.execute.mockResolvedValue([{ id: 1, text: 'y' }]);

    const row = await updateNotification(1, { text: 'y' });

    expect(row).toEqual({ id: 1, text: 'y' });
  });
});

describe('deleteNotification', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue([{ id: 5 }]);
  });

  it('deletes by id', async () => {
    const row = await deleteNotification(5);
    expect(row).toEqual({ id: 5 });
  });
});
