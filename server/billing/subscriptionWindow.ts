import type Stripe from 'stripe';

export const LIVE_STATUSES = new Set(['active', 'trialing']);
export const PAST_DUE_GRACE_MS = 3 * 86_400_000;

// A failed renewal moves current_period_end a full period ahead while Stripe
// retries the card, so past_due access is capped to a short grace instead.
export function subscriptionWindow(
  sub: Pick<Stripe.Subscription, 'status' | 'start_date' | 'ended_at'>,
  item: Pick<
    Stripe.SubscriptionItem,
    'current_period_start' | 'current_period_end'
  >,
  now: Date
): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(sub.start_date * 1000);
  const periodEnd = new Date(item.current_period_end * 1000);

  if (sub.status === 'incomplete') return { startsAt, endsAt: startsAt };
  if (LIVE_STATUSES.has(sub.status)) return { startsAt, endsAt: periodEnd };
  if (sub.status === 'past_due') {
    const graceEnd = new Date(
      item.current_period_start * 1000 + PAST_DUE_GRACE_MS
    );
    return { startsAt, endsAt: graceEnd < periodEnd ? graceEnd : periodEnd };
  }
  return {
    startsAt,
    endsAt: sub.ended_at ? new Date(sub.ended_at * 1000) : now,
  };
}
