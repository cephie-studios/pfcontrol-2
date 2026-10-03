import crypto from 'crypto';
import { Request } from 'express';

// A keyed hash of the user id, so upstream never learns who our users are.
export function chartSubjectForUserId(userId: string): string | null {
  const secret = process.env.CHART_SUBJECT_SECRET?.trim();
  if (!secret) {
    console.warn('[Celesbit] CHART_SUBJECT_SECRET not set');
    return null;
  }

  return crypto
    .createHmac('sha256', secret)
    .update(`charts:${userId}`)
    .digest('hex')
    .slice(0, 32);
}

export function chartSubjectFor(req: Request): string | null {
  const userId = req.user?.userId;
  return userId ? chartSubjectForUserId(userId) : null;
}
