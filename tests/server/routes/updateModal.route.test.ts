import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRequest } from '../helpers/appRequest.js';

vi.mock('../../../server/db/updateModals.js', () => ({
  getActiveUpdateModal: vi.fn(),
}));

import { getActiveUpdateModal } from '../../../server/db/updateModals.js';
import updateModalRouter from '../../../server/routes/updateModal.js';

describe('GET /api/update-modal/active', () => {
  const app = express();
  app.use('/', updateModalRouter);

  beforeEach(() => {
    vi.mocked(getActiveUpdateModal).mockReset();
  });

  it('returns modal payload', async () => {
    vi.mocked(getActiveUpdateModal).mockResolvedValue(null);

    const res = await appRequest(app, 'GET', '/active');

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});
