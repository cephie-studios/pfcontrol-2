import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  executeTakeFirst: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({
          executeTakeFirst: mocks.executeTakeFirst,
        })),
      })),
    })),
  },
  redisConnection: {},
}));

vi.mock('../../../server/utils/encryption.js', () => ({
  encrypt: vi.fn(() => ({ iv: 'i', data: 'd', authTag: 'a' })),
  decrypt: vi.fn(),
}));

import { logAdminAction } from '../../../server/db/audit.js';

describe('logAdminAction', () => {
  beforeEach(() => {
    mocks.executeTakeFirst.mockReset();
  });

  it('returns new audit log id', async () => {
    mocks.executeTakeFirst.mockResolvedValue({ id: 99, created_at: new Date() });

    const id = await logAdminAction({
      adminId: '1',
      adminUsername: 'admin',
      actionType: 'TEST',
    });

    expect(id).toBe(99);
  });
});
