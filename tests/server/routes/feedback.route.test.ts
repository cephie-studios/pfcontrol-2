import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRequest } from '../helpers/appRequest.js';

vi.mock('../../../server/middleware/auth.js', () => ({
  __esModule: true,
  default: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    req.user = {
      userId: 'u1',
      username: 'User',
      discriminator: '0',
      avatar: null,
      isAdmin: false,
    };
    next();
  },
}));

vi.mock('../../../server/db/feedback.js', () => ({
  addFeedback: vi.fn(),
}));

import { addFeedback } from '../../../server/db/feedback.js';
import feedbackRouter from '../../../server/routes/feedback.js';

describe('POST /api/feedback', () => {
  const app = express();
  app.use(express.json());
  app.use('/', feedbackRouter);

  beforeEach(() => {
    vi.mocked(addFeedback).mockReset();
    vi.mocked(addFeedback).mockResolvedValue({ id: 1 } as never);
  });

  it('returns 400 when rating is out of range', async () => {
    const res = await appRequest(app, 'POST', '/', { rating: 10 });

    expect(res.status).toBe(400);
  });

  it('creates feedback when valid', async () => {
    const res = await appRequest(app, 'POST', '/', {
      rating: 5,
      comment: ' ok ',
    });

    expect(res.status).toBe(200);
    expect(addFeedback).toHaveBeenCalled();
  });
});
