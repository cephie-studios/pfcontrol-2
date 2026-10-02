import { Request } from 'express';

/**
 * Who a Celesbit chart is being fetched for.
 *
 * Celesbit marks every plate with the recipient so a leaked chart can be traced back, and asks us
 * to name that recipient because it only ever sees our API key. Without a name, every plate we
 * serve carries the same mark and a leak traces no further than "PFControl" -- with one, it traces
 * to the account, and that one account can be cut off without our key being revoked.
 *
 * Which is why the chart routes require a signed-in user: a name we cannot tie back to anybody is
 * not worth marking a plate with.
 */

// Celesbit accepts 1-64 characters of letters, digits, dot, dash, underscore or at-sign.
const PERMITTED = /^[A-Za-z0-9._@-]{1,64}$/;

export function chartSubjectFor(req: Request): string | null {
  const userId = req.user?.userId;
  if (!userId) return null;

  // Prefixed so the shape stays ours even if user ids ever change form.
  const subject = `u${userId}`;
  return PERMITTED.test(subject) ? subject : null;
}
