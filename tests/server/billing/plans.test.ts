import { describe, expect, it } from 'vitest';
import {
  addMonths,
  effectivePlan,
  passAmount,
  passWindow,
  planAtLeast,
  supportedDays,
  supporterMonths,
  type Grant,
} from '../../../server/billing/plans.js';

const day = 86_400_000;
const now = new Date('2026-10-19T12:00:00Z');
const grant = (
  plan: Grant['plan'],
  startOffsetDays: number,
  endOffsetDays: number
): Grant => ({
  plan,
  startsAt: new Date(+now + startOffsetDays * day),
  endsAt: new Date(+now + endOffsetDays * day),
});

describe('billing plans', () => {
  it('orders plans', () => {
    expect(planAtLeast('supporter', 'free')).toBe(true);
    expect(planAtLeast('free', 'supporter')).toBe(false);
    expect(planAtLeast('free', 'free')).toBe(true);
  });

  it('charges a year pass at the yearly price', () => {
    expect(passAmount('supporter', 1)).toBe(100);
    expect(passAmount('supporter', 3)).toBe(300);
    expect(passAmount('supporter', 12)).toBe(1000);
  });

  it('clamps month ends', () => {
    expect(addMonths(new Date('2026-01-31T10:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T10:00:00.000Z'
    );
    expect(addMonths(new Date('2026-11-15T00:00:00Z'), 3).toISOString()).toBe(
      '2027-02-15T00:00:00.000Z'
    );
  });

  it('only counts grants that are running now', () => {
    expect(effectivePlan([], now)).toBe('free');
    expect(effectivePlan([grant('supporter', -5, 5)], now)).toBe('supporter');
    expect(effectivePlan([grant('supporter', -10, -1)], now)).toBe('free');
    expect(effectivePlan([grant('supporter', 1, 10)], now)).toBe('free');
  });

  it('counts overlapping support once and ignores the future', () => {
    const grants = [
      grant('supporter', -90, -30),
      grant('supporter', -60, 30),
      grant('supporter', 30, 60),
    ];
    expect(supportedDays(grants, now)).toBe(90);
    expect(supporterMonths(grants, now)).toBe(3);
  });

  it('queues a pass after the last running pass', () => {
    const queued = [grant('supporter', -10, 20), grant('supporter', -10, 50)];
    const window = passWindow(queued, 'supporter', 1, now);
    expect(window.startsAt).toEqual(queued[1].endsAt);
    expect(window.endsAt).toEqual(addMonths(queued[1].endsAt, 1));
  });

  it('starts a pass now when nothing is queued', () => {
    const window = passWindow(
      [grant('supporter', -40, -10)],
      'supporter',
      3,
      now
    );
    expect(window.startsAt).toEqual(now);
    expect(window.endsAt).toEqual(addMonths(now, 3));
  });
});
