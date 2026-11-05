import { getUserRoles } from '../db/roles.js';
import type { Settings } from '../db/types/Settings.js';
import { isAdmin } from '../middleware/admin.js';
import { getUserPlan } from './entitlements.js';
import type { Plan } from './plans.js';

export interface PlanLimits {
  maxSessions: number;
  featuredFlights: number;
  snapsPerFlight: number;
  animatedBackgrounds: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxSessions: 50,
    featuredFlights: 3,
    snapsPerFlight: 12,
    animatedBackgrounds: false,
  },
  supporter: {
    maxSessions: 100,
    featuredFlights: 10,
    snapsPerFlight: 30,
    animatedBackgrounds: true,
  },
};

async function hasControllerRole(userId: string): Promise<boolean> {
  if (isAdmin(userId)) return true;
  const roles = await getUserRoles(userId);
  return roles.some((role) => {
    if (role.name === 'Tester' || role.name === 'Event Controller') {
      return true;
    }
    const permissions =
      typeof role.permissions === 'string'
        ? JSON.parse(role.permissions)
        : role.permissions;
    return permissions?.pfatc_sector === true;
  });
}

export async function getPlanLimits(userId: string): Promise<PlanLimits> {
  const [plan, controller] = await Promise.all([
    getUserPlan(userId),
    hasControllerRole(userId),
  ]);
  const limits = PLAN_LIMITS[plan];
  // Event staff have always had the higher session cap, plan or not.
  return controller
    ? { ...limits, maxSessions: PLAN_LIMITS.supporter.maxSessions }
    : limits;
}

export function hasLapsedAnimatedBackground(
  settings: Partial<Settings> | null | undefined,
  limits: PlanLimits
): boolean {
  const animated = settings?.animatedBackground;
  return (
    !limits.animatedBackgrounds &&
    !!animated &&
    settings?.backgroundImage?.selectedImage === animated
  );
}
