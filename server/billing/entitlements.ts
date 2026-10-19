import { redisConnection } from '../db/connection.js';
import { getPlanGrants, type PlanGrant } from '../db/billing.js';
import { isTester } from '../db/testers.js';
import { isAdmin } from '../middleware/admin.js';
import { DEPLOYMENT, prefixKey } from '../utils/cacheTtl.js';
import {
  effectivePlan,
  planAtLeast,
  supporterMonths,
  type BillingInterval,
  type PaidPlan,
  type Plan,
} from './plans.js';

const CACHE_TTL_SEC = 120;

export interface PlanState {
  plan: Plan;
  supporterPlan: Plan;
  staffAccess: boolean;
  supporterMonths: number;
  supporterSince: string | null;
  subscription: {
    plan: PaidPlan;
    status: string;
    interval: BillingInterval | null;
    renewsAt: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  passEndsAt: string | null;
}

const cacheKey = (userId: string) => prefixKey(`plan:${userId}`);

function buildState(
  grants: PlanGrant[],
  staffAccess: boolean,
  now: Date
): PlanState {
  const supporterPlan = effectivePlan(grants, now);
  const subscription = grants.find(
    (g) => g.source === 'subscription' && g.startsAt <= now && g.endsAt > now
  );
  const passes = grants.filter(
    (g) => g.source !== 'subscription' && g.endsAt > now
  );
  const passEndsAt = passes.length
    ? new Date(Math.max(...passes.map((g) => +g.endsAt)))
    : null;
  const paid = grants.filter((g) => g.startsAt <= now);

  return {
    plan: staffAccess ? 'supporter' : supporterPlan,
    supporterPlan,
    staffAccess,
    supporterMonths: supporterMonths(grants, now),
    supporterSince: paid.length ? paid[0].startsAt.toISOString() : null,
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.subscriptionStatus ?? 'active',
          interval: subscription.interval,
          renewsAt: subscription.endsAt.toISOString(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
    passEndsAt: passEndsAt?.toISOString() ?? null,
  };
}

async function hasStaffAccess(userId: string): Promise<boolean> {
  if (isAdmin(userId)) return true;
  // Testers check paid features on canary without paying for them.
  return DEPLOYMENT !== 'production' && (await isTester(userId));
}

export async function getPlanState(userId: string): Promise<PlanState> {
  try {
    const cached = await redisConnection.get(cacheKey(userId));
    if (cached) return JSON.parse(cached) as PlanState;
  } catch {
    // Redis down: fall through to the database.
  }

  const [grants, staffAccess] = await Promise.all([
    getPlanGrants(userId),
    hasStaffAccess(userId),
  ]);
  const state = buildState(grants, staffAccess, new Date());

  // Never cache past the moment a grant starts or ends.
  const now = Date.now();
  const nextChange = grants
    .flatMap((g) => [+g.startsAt, +g.endsAt])
    .filter((t) => t > now)
    .reduce((min, t) => Math.min(min, t), Infinity);
  const ttl = Math.max(
    1,
    Math.min(CACHE_TTL_SEC, Math.ceil((nextChange - now) / 1000))
  );
  try {
    await redisConnection.set(
      cacheKey(userId),
      JSON.stringify(state),
      'EX',
      ttl
    );
  } catch {
    // Caching is best effort.
  }
  return state;
}

export async function getUserPlan(userId: string): Promise<Plan> {
  return (await getPlanState(userId)).plan;
}

export async function hasPlan(userId: string, required: Plan) {
  return planAtLeast(await getUserPlan(userId), required);
}

export async function invalidatePlan(userId: string): Promise<void> {
  try {
    await redisConnection.del(cacheKey(userId));
  } catch {
    // The entry expires on its own within CACHE_TTL_SEC.
  }
}
