import type { SubscriptionPlan } from '../middleware/planGuard.js';

export interface PlanCapabilities {
  maxSessions: number;
  pfatcOverview: boolean;
  basicAcars: boolean;
  pdcAtis: boolean;
  profileBadge: boolean;
  customBackgrounds: boolean;
  textChat: boolean;
  voiceChat: boolean;
  earlyAccess: boolean;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanCapabilities> = {
  free: {
    maxSessions: 3,
    pfatcOverview: true,
    basicAcars: true,
    pdcAtis: false,
    profileBadge: false,
    customBackgrounds: false,
    textChat: false,
    voiceChat: false,
    earlyAccess: false,
  },
  basic: {
    maxSessions: 50,
    pfatcOverview: true,
    basicAcars: true,
    pdcAtis: true,
    profileBadge: true,
    customBackgrounds: true,
    textChat: true,
    voiceChat: false,
    earlyAccess: false,
  },
  ultimate: {
    maxSessions: 250,
    pfatcOverview: true,
    basicAcars: true,
    pdcAtis: true,
    profileBadge: true,
    customBackgrounds: true,
    textChat: true,
    voiceChat: true,
    earlyAccess: true,
  },
};

export function getPlanCapabilitiesForPlan(
  plan: SubscriptionPlan
): PlanCapabilities {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

