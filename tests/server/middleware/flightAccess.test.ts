import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

type Row = Record<string, unknown> | undefined;

const rows: { sessions: Row; flights: Row } = {
  sessions: undefined,
  flights: undefined,
};

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {
    selectFrom: (table: 'sessions' | 'flights') => {
      const builder = {
        select: () => builder,
        where: () => builder,
        executeTakeFirst: async () => rows[table],
      };
      return builder;
    },
  },
}));

vi.mock('../../../server/db/roles.js', () => ({
  getUserRoles: vi.fn(async () => []),
}));

import {
  requireFlightAccess,
  requireFlightDeleteAccess,
} from '../../../server/middleware/flightAccess.js';

function call(
  middleware: (req: Request, res: Response, next: NextFunction) => unknown,
  userId: string | undefined = 'pilot-1'
) {
  const req = {
    params: { sessionId: 'c28ad178', flightId: 'a8df5be3' },
    query: {},
    body: {},
    user: userId ? { userId } : undefined,
  } as unknown as Request;

  const result: { status?: number; body?: unknown; nexted: boolean } = {
    nexted: false,
  };
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    result.nexted = true;
  };

  return Promise.resolve(middleware(req, res, next)).then(() => result);
}

describe('flight access when the session is gone', () => {
  beforeEach(() => {
    rows.sessions = undefined;
    rows.flights = undefined;
  });

  it('still 404s on routes that require a live session', async () => {
    rows.flights = { user_id: 'pilot-1' };

    const res = await call(requireFlightAccess);

    expect(res.nexted).toBe(false);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Session not found' });
  });

  it('lets the pilot delete their own orphaned flight', async () => {
    rows.flights = { user_id: 'pilot-1' };

    const res = await call(requireFlightDeleteAccess);

    expect(res.nexted).toBe(true);
    expect(res.status).toBeUndefined();
  });

  it('treats an already deleted flight as a no-op', async () => {
    rows.flights = undefined;

    const res = await call(requireFlightDeleteAccess);

    expect(res.nexted).toBe(true);
  });

  it('does not let another user delete an orphaned flight', async () => {
    rows.flights = { user_id: 'pilot-2' };

    const res = await call(requireFlightDeleteAccess);

    expect(res.nexted).toBe(false);
    expect(res.status).toBe(404);
  });

  it('does not let anyone delete an orphaned flight with no owner', async () => {
    rows.flights = { user_id: null };

    const res = await call(requireFlightDeleteAccess);

    expect(res.nexted).toBe(false);
    expect(res.status).toBe(404);
  });
});

describe('flight access with a live session', () => {
  beforeEach(() => {
    rows.sessions = {
      session_id: 'c28ad178',
      access_id: 'a'.repeat(64),
      created_by: 'controller-1',
      is_pfatc: false,
      is_advanced_atc: false,
    };
    rows.flights = { user_id: 'pilot-1' };
  });

  it('allows the session creator', async () => {
    const res = await call(requireFlightDeleteAccess, 'controller-1');

    expect(res.nexted).toBe(true);
  });

  it('rejects an unrelated user', async () => {
    const res = await call(requireFlightDeleteAccess, 'pilot-1');

    expect(res.nexted).toBe(false);
    expect(res.status).toBe(403);
  });
});
