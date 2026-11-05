import { describe, expect, it } from 'vitest';
import {
  PAST_DUE_GRACE_MS,
  subscriptionWindow,
} from '../../../server/billing/subscriptionWindow.js';

const sec = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const now = new Date('2026-10-20T00:00:00Z');
const item = {
  current_period_start: sec('2026-10-10T00:00:00Z'),
  current_period_end: sec('2026-11-10T00:00:00Z'),
};
const sub = (status: string, ended_at: number | null = null) =>
  ({
    status,
    start_date: sec('2026-01-10T00:00:00Z'),
    ended_at,
  }) as Parameters<typeof subscriptionWindow>[0];

describe('subscriptionWindow', () => {
  it('runs to the period end while active or trialing', () => {
    for (const status of ['active', 'trialing']) {
      expect(subscriptionWindow(sub(status), item, now).endsAt).toEqual(
        new Date('2026-11-10T00:00:00Z')
      );
    }
  });

  it('gives a past due renewal only a short grace from the period start', () => {
    const { endsAt } = subscriptionWindow(sub('past_due'), item, now);
    expect(+endsAt).toBe(item.current_period_start * 1000 + PAST_DUE_GRACE_MS);
  });

  it('gives nothing for an incomplete payment', () => {
    const { startsAt, endsAt } = subscriptionWindow(
      sub('incomplete'),
      item,
      now
    );
    expect(endsAt).toEqual(startsAt);
  });

  it('ends at the cancellation time once cancelled', () => {
    const ended = sec('2026-10-15T00:00:00Z');
    expect(
      subscriptionWindow(sub('canceled', ended), item, now).endsAt
    ).toEqual(new Date('2026-10-15T00:00:00Z'));
    expect(subscriptionWindow(sub('unpaid'), item, now).endsAt).toEqual(now);
  });
});
