import { Request, Response, NextFunction } from 'express';
import { getUserById } from '../db/users.js';
import requireAuth from './auth.js';
import { isAdmin } from './admin.js';
import { isTester } from './tester.js';

export type SubscriptionPlan = 'free' | 'basic' | 'ultimate';

export function comparePlans(userPlan: SubscriptionPlan, required: SubscriptionPlan) {
  const order: SubscriptionPlan[] = ['free', 'basic', 'ultimate'];
  return order.indexOf(userPlan) - order.indexOf(required);
}

export async function getUserPlan(userId: string): Promise<SubscriptionPlan> {
  if (isAdmin(userId)) return 'ultimate';
  if (await isTester(userId)) return 'ultimate';

  const user = await getUserById(userId);
  if (!user) return 'free';

  const plan: SubscriptionPlan | null =
    (user.subscription_plan as SubscriptionPlan | null) ?? null;
  const status: string | null =
    (user.subscription_status as string | null) ?? null;

  if (
    (plan === 'basic' || plan === 'ultimate') &&
    status === 'active'
  ) {
    return plan;
  }
  return 'free';
}

export function requirePlan(required: SubscriptionPlan) {
  return [
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userJwt = req.user;
        if (!userJwt) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const plan = await getUserPlan(userJwt.userId);
        if (comparePlans(plan, required) < 0) {
          return res.status(402).json({
            error: 'Upgrade required',
            requiredPlan: required,
            currentPlan: plan,
          });
        }

        next();
      } catch (error) {
        console.error('[PlanGuard] Error checking plan:', error);
        return res.status(500).json({ error: 'Failed to check subscription' });
      }
    },
  ];
}

