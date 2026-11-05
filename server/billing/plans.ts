export type PaidPlan = 'supporter';
export type Plan = 'free' | PaidPlan;
export type BillingInterval = 'month' | 'year';
export type GrantSource = 'subscription' | 'pass' | 'gift' | 'admin';

export const PLAN_ORDER: Plan[] = ['free', 'supporter'];
export const PAID_PLANS: PaidPlan[] = ['supporter'];
export const PASS_MONTHS = [1, 3, 12] as const;
export type PassMonths = (typeof PASS_MONTHS)[number];

export const CURRENCY = 'usd';

export const PRICES: Record<PaidPlan, Record<BillingInterval, number>> = {
  supporter: { month: 100, year: 1000 },
};

export const PLAN_NAMES: Record<Plan, string> = {
  free: 'Free',
  supporter: 'Supporter',
};

export const SUPPORTER_RINGS = [
  'plan',
  'aurora',
  'sunset',
  'radar',
  'custom',
] as const;
export type SupporterRing = (typeof SUPPORTER_RINGS)[number];

export const DEFAULT_RING_COLORS = ['#22d3ee', '#a78bfa', '#f472b6'];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isRingColors(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 3 &&
    value.every((c) => typeof c === 'string' && HEX_COLOR.test(c))
  );
}

export interface Grant {
  plan: PaidPlan;
  startsAt: Date;
  endsAt: Date;
}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === 'supporter';
}

export function isPassMonths(value: unknown): value is PassMonths {
  return PASS_MONTHS.includes(value as PassMonths);
}

export function planAtLeast(plan: Plan, required: Plan): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(required);
}

export function passAmount(plan: PaidPlan, months: PassMonths): number {
  return months === 12 ? PRICES[plan].year : PRICES[plan].month * months;
}

export function subscriptionLookupKey(
  plan: PaidPlan,
  interval: BillingInterval
): string {
  return `pfcontrol_${plan}_${interval}ly`;
}

export function passLookupKey(plan: PaidPlan, months: PassMonths): string {
  return `pfcontrol_${plan}_pass_${months}m`;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)
  ).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

export function activeGrants(grants: Grant[], now: Date): Grant[] {
  return grants.filter((g) => g.startsAt <= now && g.endsAt > now);
}

export function effectivePlan(grants: Grant[], now: Date): Plan {
  return activeGrants(grants, now).reduce<Plan>(
    (best, g) => (planAtLeast(g.plan, best) ? g.plan : best),
    'free'
  );
}

// Overlapping grants (a gift during a subscription) count once.
export function supportedDays(grants: Grant[], now: Date): number {
  const spans = grants
    .map((g) => [g.startsAt.getTime(), Math.min(g.endsAt.getTime(), +now)])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cursor = -Infinity;
  for (const [start, end] of spans) {
    const from = Math.max(start, cursor);
    if (end > from) total += end - from;
    cursor = Math.max(cursor, end);
  }
  return Math.floor(total / 86_400_000);
}

export function supporterMonths(grants: Grant[], now: Date): number {
  return Math.floor(supportedDays(grants, now) / 30);
}

// A new pass starts when the last pass for the same plan runs out, so
// stacking gifts never wastes days.
export function passWindow(
  grants: Grant[],
  plan: PaidPlan,
  months: PassMonths,
  now: Date
): { startsAt: Date; endsAt: Date } {
  const queuedEnd = grants
    .filter((g) => g.plan === plan && g.endsAt > now)
    .reduce((latest, g) => (g.endsAt > latest ? g.endsAt : latest), now);
  return { startsAt: queuedEnd, endsAt: addMonths(queuedEnd, months) };
}
