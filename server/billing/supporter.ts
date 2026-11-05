import { getSupporterPrefs } from '../db/billing.js';
import { getPlanState } from './entitlements.js';
import { PLAN_NAMES, type PaidPlan, type SupporterRing } from './plans.js';

export interface SupporterBadge {
  plan: PaidPlan;
  months: number;
  since: string | null;
  ring: SupporterRing;
}

export interface AvatarRing {
  plan: PaidPlan;
  ring: SupporterRing;
  colors?: string[];
}

export const SUPPORTER_COLORS: Record<PaidPlan, string> = {
  supporter: '#F59E0B',
};

export async function getSupporterBadge(
  userId: string
): Promise<SupporterBadge | null> {
  const [state, prefs] = await Promise.all([
    getPlanState(userId),
    getSupporterPrefs(userId),
  ]);
  if (state.supporterPlan === 'free') return null;
  return {
    plan: state.supporterPlan,
    months: state.supporterMonths,
    since: state.supporterSince,
    ring: prefs.ring,
  };
}

// Follows the effective plan, so staff access shows a ring even without a badge.
export async function getAvatarRing(
  userId: string
): Promise<AvatarRing | null> {
  const [state, prefs] = await Promise.all([
    getPlanState(userId),
    getSupporterPrefs(userId),
  ]);
  if (state.plan === 'free') return null;
  const { ring } = prefs;
  return ring === 'custom'
    ? { plan: state.plan, ring, colors: prefs.colors }
    : { plan: state.plan, ring };
}

// Below every real role, so staff colours still win in session avatars.
export function supporterRole(badge: SupporterBadge | null) {
  if (!badge) return null;
  return {
    id: -20,
    name: PLAN_NAMES[badge.plan],
    color: SUPPORTER_COLORS[badge.plan],
    icon: 'PilotWings',
    priority: -1,
  };
}
