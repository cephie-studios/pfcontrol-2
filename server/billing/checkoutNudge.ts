import { getAbandonedCheckoutAt, markCheckoutStarted } from '../db/billing.js';
import { getPlanState } from './entitlements.js';
import { isBillingEnabled, stripe } from './stripe.js';

const NUDGE_AFTER_MS = 16 * 60 * 60 * 1000;
const BACKFILL_DAYS = 14;

export async function getCheckoutNudge(userId: string): Promise<Date | null> {
  if (!isBillingEnabled()) return null;
  const startedAt = await getAbandonedCheckoutAt(userId);
  if (!startedAt || Date.now() - +startedAt < NUDGE_AFTER_MS) return null;
  const { supporterPlan } = await getPlanState(userId);
  return supporterPlan === 'free' ? startedAt : null;
}

// Picks up checkouts opened before checkout_started_at was recorded.
export async function backfillCheckoutStarts(): Promise<void> {
  if (!stripe) return;
  const since = Math.floor(Date.now() / 1000) - BACKFILL_DAYS * 24 * 60 * 60;
  for await (const session of stripe.checkout.sessions.list({
    created: { gte: since },
    limit: 100,
  })) {
    const meta = session.metadata ?? {};
    const userId =
      meta.kind === 'subscription'
        ? meta.userId
        : meta.kind === 'pass' && meta.buyerId === meta.recipientId
          ? meta.buyerId
          : null;
    if (!userId) continue;
    await markCheckoutStarted(userId, new Date(session.created * 1000));
  }
}
