import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflict: vi.fn(() => ({
          execute: mocks.execute,
        })),
      })),
    })),
    deleteFrom: vi.fn(() => ({
      where: vi.fn(() => ({
        execute: mocks.execute,
      })),
    })),
  },
  redisConnection: {},
}));

import {
  cleanupOldStatistics,
  recordLogin,
  recordNewFlight,
  recordNewSession,
  recordNewUser,
} from '../../../server/db/statistics.js';

describe('recordLogin', () => {
  beforeEach(() => {
    mocks.execute.mockClear();
    mocks.execute.mockResolvedValue(undefined);
  });

  it('runs insert upsert without throwing', async () => {
    await recordLogin();
    expect(mocks.execute).toHaveBeenCalled();
  });
});

describe('recordNewSession', () => {
  beforeEach(() => {
    mocks.execute.mockClear();
    mocks.execute.mockResolvedValue(undefined);
  });

  it('runs insert upsert without throwing', async () => {
    await recordNewSession();
    expect(mocks.execute).toHaveBeenCalled();
  });
});

describe('recordNewFlight', () => {
  beforeEach(() => {
    mocks.execute.mockClear();
    mocks.execute.mockResolvedValue(undefined);
  });

  it('runs insert upsert without throwing', async () => {
    await recordNewFlight();
    expect(mocks.execute).toHaveBeenCalled();
  });
});

describe('recordNewUser', () => {
  beforeEach(() => {
    mocks.execute.mockClear();
    mocks.execute.mockResolvedValue(undefined);
  });

  it('runs insert upsert without throwing', async () => {
    await recordNewUser();
    expect(mocks.execute).toHaveBeenCalled();
  });
});

describe('cleanupOldStatistics', () => {
  beforeEach(() => {
    mocks.execute.mockClear();
    mocks.execute.mockResolvedValue(undefined);
  });

  it('can delete old rows when throttle allows', async () => {
    await cleanupOldStatistics();
    await cleanupOldStatistics();
    expect(mocks.execute).toHaveBeenCalled();
  });
});
