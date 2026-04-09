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
      userId: 'pilot1',
      username: 'Pilot',
      discriminator: '0',
      avatar: null,
      isAdmin: false,
    };
    next();
  },
}));

vi.mock('../../../server/db/ratings.js', () => ({
  addControllerRating: vi.fn(),
}));

import { addControllerRating } from '../../../server/db/ratings.js';
import ratingsRouter from '../../../server/routes/ratings.js';

describe('POST /api/ratings', () => {
  const app = express();
  app.use(express.json());
  app.use('/', ratingsRouter);

  beforeEach(() => {
    vi.mocked(addControllerRating).mockReset();
    vi.mocked(addControllerRating).mockResolvedValue(undefined);
  });

  it('returns 400 when controllerId is missing', async () => {
    const res = await appRequest(app, 'POST', '/', { rating: 5 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when rating self', async () => {
    const res = await appRequest(app, 'POST', '/', {
      controllerId: 'pilot1',
      rating: 5,
    });

    expect(res.status).toBe(400);
  });

  it('submits rating when valid', async () => {
    const res = await appRequest(app, 'POST', '/', {
      controllerId: 'ctrl1',
      rating: 4,
      flightId: 'f1',
    });

    expect(res.status).toBe(200);
    expect((res.body as { success: boolean }).success).toBe(true);
    expect(addControllerRating).toHaveBeenCalledWith(
      'ctrl1',
      'pilot1',
      4,
      'f1'
    );
  });
});
