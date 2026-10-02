import crypto from 'node:crypto';

import { Request, Response } from 'express';

/**
 * Who a Celesbit chart is being fetched for.
 *
 * Celesbit marks every plate with the recipient so a leaked chart can be traced back, and asks us
 * to name that recipient because it only ever sees our API key. Without a name, every plate we
 * serve carries the same mark and a leak traces no further than "PFControl" -- with one, it traces
 * to the account, and that one account can be cut off without our key being revoked.
 *
 * Signed-in users are named by their user id. Anonymous ones keep a random id in a cookie, so that
 * charts stay available to them as they are today; it is weaker evidence, since clearing cookies
 * starts a new one, but it is a great deal better than everybody sharing a single mark.
 */
const ANONYMOUS_COOKIE = 'chart_subject';
const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

// Celesbit accepts 1-64 characters of letters, digits, dot, dash, underscore or at-sign.
const PERMITTED = /^[A-Za-z0-9._@-]{1,64}$/;

export function chartSubjectFor(req: Request, res: Response): string {
  const userId = req.user?.userId;
  if (userId) {
    // Prefixed so a user id and an anonymous id can never collide.
    const subject = `u${userId}`;
    if (PERMITTED.test(subject)) return subject;
  }

  const existing = req.cookies?.[ANONYMOUS_COOKIE];
  if (
    typeof existing === 'string' &&
    PERMITTED.test(existing) &&
    existing.startsWith('a')
  ) {
    return existing;
  }

  const minted = `a${crypto.randomBytes(16).toString('hex')}`;
  res.cookie(ANONYMOUS_COOKIE, minted, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
  });
  return minted;
}
