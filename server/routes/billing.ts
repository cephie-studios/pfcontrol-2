import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import type Stripe from 'stripe';

import requireAuth, { optionalAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import {
  getStripeCustomerId,
  getSupporterPrefs,
  insertQueuedPass,
  setStripeCustomerId,
  setSupporterPrefs,
} from '../db/billing.js';
import { getUserById, getUserByUsername } from '../db/users.js';
import { getPlanState, invalidatePlan } from '../billing/entitlements.js';
import { handleStripeEvent } from '../billing/fulfillment.js';
import {
  getSupporterWall,
  invalidateSupporterWall,
  scheduleSupporterWallInvalidation,
} from '../billing/wall.js';
import { PLAN_LIMITS } from '../billing/limits.js';
import {
  CURRENCY,
  PAID_PLANS,
  PASS_MONTHS,
  PLAN_NAMES,
  PRICES,
  SUPPORTER_RINGS,
  isPaidPlan,
  isRingColors,
  isPassMonths,
  passAmount,
  passLookupKey,
  passWindow,
  planAtLeast,
  subscriptionLookupKey,
  type SupporterRing,
} from '../billing/plans.js';
import {
  WEBHOOK_SECRET,
  isBillingEnabled,
  priceIdFor,
  stripe,
} from '../billing/stripe.js';
import { applyPublicCache } from '../utils/httpCache.js';

const router = express.Router();
const FRONTEND_URL = (process.env.FRONTEND_URL ?? '').replace(/\/+$/, '');
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{2,32}$/;

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many checkout attempts. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function formatAmount(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY,
  }).format(cents / 100);
}

async function ensureCustomer(userId: string): Promise<string> {
  const existing = await getStripeCustomerId(userId);
  if (existing) return existing;
  const user = await getUserById(userId);
  const customer = await stripe!.customers.create({
    name: user?.username,
    metadata: { userId },
  });
  await setStripeCustomerId(userId, customer.id);
  return customer.id;
}

// POST: /api/billing/webhook - Stripe events. Mounted before express.json()
// because the signature covers the raw body.
export async function stripeWebhookHandler(req: Request, res: Response) {
  if (!stripe || !WEBHOOK_SECRET) {
    return res.status(503).send('Billing is not configured');
  }
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    return res.status(400).send('Missing signature');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, WEBHOOK_SECRET);
  } catch {
    return res.status(400).send('Invalid signature');
  }

  try {
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (error) {
    // Handlers are idempotent, so a 500 lets Stripe retry safely.
    console.error(`[Billing] Failed to handle ${event.type}:`, error);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
}

// GET: /api/billing/catalog - prices and the public supporter wall
router.get('/catalog', async (_req, res) => {
  const supporters = await getSupporterWall().catch((error) => {
    console.error('[Billing] Failed to load supporters:', error);
    return { count: 0, wall: [], admins: [] };
  });
  applyPublicCache(res, { browserMaxAge: 15, edgeMaxAge: 30 });
  res.json({
    enabled: isBillingEnabled(),
    currency: CURRENCY,
    plans: Object.fromEntries(
      PAID_PLANS.map((plan) => [
        plan,
        {
          month: PRICES[plan].month,
          year: PRICES[plan].year,
          passes: Object.fromEntries(
            PASS_MONTHS.map((months) => [months, passAmount(plan, months)])
          ),
        },
      ])
    ),
    limits: PLAN_LIMITS,
    supporters,
  });
});

// GET: /api/billing/me - the signed-in user's plan, perks and preferences
router.get('/me', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [state, prefs, customerId] = await Promise.all([
    getPlanState(userId),
    getSupporterPrefs(userId),
    getStripeCustomerId(userId),
  ]);
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({
    ...state,
    prefs,
    billingEnabled: isBillingEnabled(),
    canManageBilling: !!customerId && !!stripe,
  });
});

// PUT: /api/billing/me/prefs - supporter wall visibility and avatar ring
router.put('/me/prefs', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { wall, ring, colors } = (req.body ?? {}) as {
    wall?: unknown;
    ring?: unknown;
    colors?: unknown;
  };
  const prefs = await getSupporterPrefs(userId);
  const before = { ...prefs };

  if (wall !== undefined) {
    if (typeof wall !== 'boolean') {
      return res.status(400).json({ error: 'Invalid wall setting' });
    }
    prefs.wall = wall;
  }
  if (ring !== undefined) {
    if (!SUPPORTER_RINGS.includes(ring as SupporterRing)) {
      return res.status(400).json({ error: 'Invalid ring' });
    }
    const { supporterPlan, plan } = await getPlanState(userId);
    if (ring !== 'plan' && !planAtLeast(plan, 'supporter')) {
      return res.status(402).json({
        error: 'Animated rings are a Supporter perk',
        requiredPlan: 'supporter',
        currentPlan: supporterPlan,
      });
    }
    prefs.ring = ring as SupporterRing;
  }
  if (colors !== undefined) {
    if (!isRingColors(colors)) {
      return res
        .status(400)
        .json({ error: 'Pick two or three colours as #rrggbb' });
    }
    prefs.colors = colors.map((c) => c.toLowerCase());
  }

  await setSupporterPrefs(userId, prefs);
  if (prefs.wall !== before.wall) void invalidateSupporterWall();
  else if (
    prefs.ring !== before.ring ||
    prefs.colors.join() !== before.colors.join()
  ) {
    scheduleSupporterWallInvalidation();
  }
  res.json({ prefs });
});

// GET: /api/billing/recipient/:username - who a gift link is for
router.get('/recipient/:username', async (req, res) => {
  const { username } = req.params;
  if (!USERNAME_PATTERN.test(username)) {
    return res.status(404).json({ error: 'Pilot not found' });
  }
  const user = await getUserByUsername(username);
  if (!user) return res.status(404).json({ error: 'Pilot not found' });
  const state = await getPlanState(user.id);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    id: user.id,
    username: user.username,
    avatar: user.avatar ?? null,
    plan: state.supporterPlan,
  });
});

interface CheckoutBody {
  kind?: unknown;
  plan?: unknown;
  interval?: unknown;
  months?: unknown;
  recipient?: unknown;
  consent?: unknown;
}

// POST: /api/billing/checkout - start a Stripe Checkout for a subscription,
// a prepaid pass, or a gift to someone else (no account needed to gift)
router.post('/checkout', checkoutLimiter, optionalAuth, async (req, res) => {
  if (!isBillingEnabled()) {
    return res.status(503).json({ error: 'Payments are not available yet' });
  }
  const body = (req.body ?? {}) as CheckoutBody;
  const { kind, plan } = body;
  if (!isPaidPlan(plan) || (kind !== 'subscription' && kind !== 'pass')) {
    return res.status(400).json({ error: 'Pick a plan' });
  }
  if (body.consent !== true) {
    return res.status(400).json({ error: 'Please confirm the checkbox' });
  }

  const buyerId = req.user?.userId ?? null;
  let recipientId = buyerId;
  let recipientName = req.user?.username ?? null;
  if (typeof body.recipient === 'string' && body.recipient) {
    if (!USERNAME_PATTERN.test(body.recipient)) {
      return res.status(404).json({ error: 'Pilot not found' });
    }
    const recipient = await getUserByUsername(body.recipient);
    if (!recipient) return res.status(404).json({ error: 'Pilot not found' });
    recipientId = recipient.id;
    recipientName = recipient.username;
  }
  if (!recipientId || !recipientName) {
    return res.status(401).json({ error: 'Log in to buy for yourself' });
  }

  const isGift = recipientId !== buyerId;
  const back = isGift
    ? `${FRONTEND_URL}/gift/${encodeURIComponent(recipientName)}`
    : `${FRONTEND_URL}/pricing`;
  const consentText =
    'Perks start as soon as you pay. Because access begins right away, the 14-day right to cancel for a refund ends once your perks are active.';

  try {
    let session: Stripe.Checkout.Session;
    if (kind === 'subscription') {
      if (isGift) {
        return res
          .status(400)
          .json({ error: 'Gifts are prepaid passes, not subscriptions' });
      }
      const interval = body.interval === 'year' ? 'year' : 'month';
      const state = await getPlanState(recipientId);
      if (state.subscription) {
        return res.status(409).json({
          error:
            'You already have a subscription. Change or cancel it from Manage billing.',
        });
      }
      session = await stripe!.checkout.sessions.create({
        mode: 'subscription',
        customer: await ensureCustomer(recipientId),
        client_reference_id: recipientId,
        line_items: [
          {
            price: await priceIdFor(subscriptionLookupKey(plan, interval)),
            quantity: 1,
          },
        ],
        subscription_data: { metadata: { userId: recipientId, plan } },
        metadata: { kind: 'subscription', userId: recipientId, plan },
        allow_promotion_codes: true,
        custom_text: {
          submit: {
            message: `Renews every ${interval} at ${formatAmount(PRICES[plan][interval])} until you cancel. Cancel anytime in PFControl Settings → Plan. ${consentText}`,
          },
        },
        success_url: `${back}?checkout=success&plan=${plan}`,
        cancel_url: back,
      });
    } else {
      const months = Number(body.months);
      if (!isPassMonths(months)) {
        return res.status(400).json({ error: 'Pick a pass length' });
      }
      session = await stripe!.checkout.sessions.create({
        mode: 'payment',
        ...(buyerId
          ? { customer: await ensureCustomer(buyerId) }
          : { customer_creation: 'always' as const }),
        client_reference_id: recipientId,
        line_items: [
          { price: await priceIdFor(passLookupKey(plan, months)), quantity: 1 },
        ],
        metadata: {
          kind: 'pass',
          recipientId,
          buyerId: buyerId ?? '',
          plan,
          months: String(months),
        },
        payment_intent_data: {
          description: `PFControl ${PLAN_NAMES[plan]} · ${months} month${months === 1 ? '' : 's'} for ${recipientName}`,
        },
        allow_promotion_codes: true,
        custom_text: {
          submit: {
            message: `One-time payment for ${months} month${months === 1 ? '' : 's'} of ${PLAN_NAMES[plan]} for ${recipientName}. It does not renew. ${consentText}`,
          },
        },
        success_url: `${back}?checkout=success&plan=${plan}`,
        cancel_url: back,
      });
    }
    res.json({ url: session.url });
  } catch (error) {
    console.error('[Billing] Failed to create checkout:', error);
    res.status(502).json({ error: 'Could not start checkout' });
  }
});

// POST: /api/billing/portal - Stripe customer portal (cancel, invoices, card)
router.post('/portal', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Payments are not available yet' });
  }
  const customerId = await getStripeCustomerId(req.user!.userId);
  if (!customerId) {
    return res.status(404).json({ error: 'No billing history yet' });
  }
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND_URL}/settings#plan-settings`,
    });
    res.json({ url: portal.url });
  } catch (error) {
    console.error('[Billing] Failed to open portal:', error);
    res.status(502).json({ error: 'Could not open billing' });
  }
});

// POST: /api/billing/admin/grant - give someone a plan for free (staff, giveaways)
router.post('/admin/grant', requireAdmin, async (req, res) => {
  const { userId, plan, months } = (req.body ?? {}) as {
    userId?: unknown;
    plan?: unknown;
    months?: unknown;
  };
  if (
    typeof userId !== 'string' ||
    !isPaidPlan(plan) ||
    !isPassMonths(Number(months))
  ) {
    return res.status(400).json({ error: 'userId, plan and months required' });
  }
  if (!(await getUserById(userId))) {
    return res.status(404).json({ error: 'User not found' });
  }
  await insertQueuedPass({
    userId,
    plan,
    source: 'admin',
    window: (queued) =>
      passWindow(queued, plan, Number(months) as 1 | 3 | 12, new Date()),
    checkoutSessionId: null,
    paymentIntentId: null,
    giftedBy: req.user?.userId ?? null,
  });
  await invalidatePlan(userId);
  res.json({ success: true });
});

export default router;
