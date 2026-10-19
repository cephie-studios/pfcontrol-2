import type { CSSProperties } from 'react';
import type {
  PaidPlan,
  PassMonths,
  Plan,
  SupporterRing,
} from '../types/billing';

export const PLAN_NAMES: Record<Plan, string> = {
  free: 'Free',
  supporter: 'Supporter',
};

export const PLAN_TEXT: Record<PaidPlan, string> = {
  supporter: 'text-amber-500',
};

export const PASS_MONTHS: PassMonths[] = [1, 3, 12];

export const SUPPORTER_RINGS: { value: SupporterRing; label: string }[] = [
  { value: 'plan', label: 'Gold' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'radar', label: 'Radar' },
  { value: 'custom', label: 'Custom' },
];

export const DEFAULT_RING_COLORS = ['#22d3ee', '#a78bfa', '#f472b6'];

export function ringStyle(
  ring: SupporterRing | undefined,
  colors: string[] | undefined
): CSSProperties | undefined {
  if (ring !== 'custom') return undefined;
  const stops = colors?.length ? colors : DEFAULT_RING_COLORS;
  return {
    '--ring-bg': `conic-gradient(from var(--ring-angle), ${stops.join(', ')}, ${stops[0]})`,
  } as CSSProperties;
}

export function nameStyle(
  ring: SupporterRing | undefined,
  colors: string[] | undefined
): CSSProperties | undefined {
  if (ring !== 'custom') return undefined;
  const stops = colors?.length ? colors : DEFAULT_RING_COLORS;
  return {
    backgroundImage: `linear-gradient(90deg, ${stops.join(', ')}, ${stops[0]})`,
  };
}

const SUPPORTER_RANKS: { months: number; name: string }[] = [
  { months: 24, name: 'Legend' },
  { months: 12, name: 'Senior Captain' },
  { months: 6, name: 'Captain' },
  { months: 3, name: 'First Officer' },
  { months: 0, name: 'Cadet' },
];

export function supporterRank(months: number) {
  const index = SUPPORTER_RANKS.findIndex((r) => months >= r.months);
  const rank = SUPPORTER_RANKS[index];
  const next = index > 0 ? SUPPORTER_RANKS[index - 1] : null;
  return { name: rank.name, next };
}

export function formatPrice(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function monthsLabel(months: number) {
  return months === 1 ? '1 month' : `${months} months`;
}

export function discordAvatarUrl(
  userId: string,
  avatar: string | null,
  size = 128
) {
  if (avatar?.startsWith('http')) return avatar;
  if (!avatar) {
    return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) % 5n)}.png`;
  }
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=${size}`;
}

export function giftLink(username: string) {
  return `${window.location.origin}/gift/${encodeURIComponent(username)}`;
}

export function supporterRingClass(
  plan: PaidPlan | null | undefined,
  ring: SupporterRing = 'plan'
): string | null {
  if (!plan) return null;
  return ring === 'plan' ? 'supporter-ring-gold' : `supporter-ring-${ring}`;
}
