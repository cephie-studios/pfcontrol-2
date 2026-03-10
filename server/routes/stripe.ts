import express from 'express';
import requireAuth from '../middleware/auth.js';
import { getUserById, invalidateUserAndUsernameCache } from '../db/users.js';
import { mainDb } from '../db/connection.js';
import { stripe, getPriceIdForTier, formatStripeAmount, StripePlanTier } from '../lib/stripe.js';

const router = express.Router();

async function ensureStripeCustomer(
  userId: string,
  existingCustomerId: string | null | undefined,
  email: string | undefined
): Promise<string> {
  if (existingCustomerId) {
    try {
      const customer = await stripe!.customers.retrieve(existingCustomerId);
      if (!(customer as { deleted?: boolean }).deleted) {
        return existingCustomerId;
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'resource_missing') {
        // Customer doesn't exist
      } else {
        throw err;
      }
    }
  }

  const customer = await stripe!.customers.create({
    metadata: { pfcontrolUserId: userId },
    email,
  });

  await mainDb
    .updateTable('users')
    .set({ stripe_customer_id: customer.id })
    .where('id', '=', userId)
    .execute();
  await invalidateUserAndUsernameCache(userId);

  return customer.id;
}

router.get('/prices', async (_req, res) => {
  try {
    if (!stripe) {
      return res.json({
        basic: null,
        ultimate: null,
      });
    }

    const basicPriceId = getPriceIdForTier('basic');
    const ultimatePriceId = getPriceIdForTier('ultimate');

    const [basicPrice, ultimatePrice] = await Promise.all([
      basicPriceId ? stripe.prices.retrieve(basicPriceId) : null,
      ultimatePriceId ? stripe.prices.retrieve(ultimatePriceId) : null,
    ]);

    const basic = basicPrice
      ? formatStripeAmount(basicPrice.unit_amount ?? null, basicPrice.currency)
      : null;
    const ultimate = ultimatePrice
      ? formatStripeAmount(ultimatePrice.unit_amount ?? null, ultimatePrice.currency)
      : null;

    res.json({ basic, ultimate });
  } catch (error) {
    console.error('[Stripe] Failed to load prices:', error);
    res.json({
      basic: null,
      ultimate: null,
    });
  }
});

router.post('/checkout-session', requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res
        .status(503)
        .json({ error: 'Stripe is not configured for this environment' });
    }

    const userJwt = req.user;
    if (!userJwt) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tier } = req.body as { tier?: string };
    const normalizedTier: StripePlanTier | null =
      tier === 'basic' ? 'basic' : tier === 'ultimate' ? 'ultimate' : null;
    if (!normalizedTier) {
      return res.status(400).json({ error: 'Missing or invalid tier' });
    }

    const priceId = getPriceIdForTier(normalizedTier);
    if (!priceId) {
      return res
        .status(500)
        .json({ error: 'Price ID not configured for requested plan' });
    }

    const user = await getUserById(userJwt.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email =
      typeof (user as any).email === 'string' && (user as any).email
        ? (user as any).email
        : undefined;
    const stripeCustomerId = await ensureStripeCustomer(
      user.id,
      user.stripe_customer_id ?? null,
      email
    );

    const frontendBaseUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const successUrl = `${frontendBaseUrl.replace(/\/$/, '')}/?stripe=success`;
    const cancelUrl = `${frontendBaseUrl.replace(/\/$/, '')}/pricing`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        pfcontrolUserId: user.id,
        requestedPlan: normalizedTier,
      },
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('[Stripe] Failed to create checkout session:', error);
    return res
      .status(500)
      .json({ error: 'Failed to create checkout session' });
  }
});

router.post('/portal-session', requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res
        .status(503)
        .json({ error: 'Stripe is not configured for this environment' });
    }

    const userJwt = req.user;
    if (!userJwt) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await getUserById(userJwt.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email =
      typeof (user as any).email === 'string' && (user as any).email
        ? (user as any).email
        : undefined;
    const stripeCustomerId = await ensureStripeCustomer(
      user.id,
      user.stripe_customer_id ?? null,
      email
    );

    const frontendBaseUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const returnUrl =
      typeof req.body?.returnUrl === 'string' && req.body.returnUrl
        ? req.body.returnUrl
        : `${frontendBaseUrl.replace(/\/$/, '')}/`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return res.json({ url: portalSession.url });
  } catch (error) {
    console.error('[Stripe] Failed to create portal session:', error);
    return res
      .status(500)
      .json({ error: 'Failed to create billing portal session' });
  }
});

router.post('/sync', requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res
        .status(503)
        .json({ error: 'Stripe is not configured for this environment' });
    }

    const userJwt = req.user;
    if (!userJwt) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await getUserById(userJwt.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stripeCustomerId = user.stripe_customer_id;
    if (!stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer associated' });
    }

    const subs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      expand: ['data.items.data.price'],
      limit: 10,
    });

    let plan: 'free' | 'basic' | 'ultimate' = 'free';
    let status: string | null = null;
    let currentPeriodEnd: Date | null = null;
    let cancelAtPeriodEnd: boolean | null = null;

    for (const s of subs.data) {
      const price = s.items.data[0]?.price;
      if (!price) continue;

      if (price.id === process.env.STRIPE_ULTIMATE_PRICE_ID) {
        plan = 'ultimate';
      } else if (
        price.id === process.env.STRIPE_BASIC_PRICE_ID &&
        plan !== 'ultimate'
      ) {
        plan = 'basic';
      }

      if (!status || s.status === 'active') {
        status = s.status;
        const rawPeriodEnd = (s as any).current_period_end as
          | number
          | undefined
          | null;
        if (typeof rawPeriodEnd === 'number') {
          currentPeriodEnd = new Date(rawPeriodEnd * 1000);
        }
        const rawCancelAtPeriodEnd = (s as any).cancel_at_period_end as
          | boolean
          | undefined
          | null;
        if (typeof rawCancelAtPeriodEnd === 'boolean') {
          cancelAtPeriodEnd = rawCancelAtPeriodEnd;
        }
      }
    }

    if (status !== 'active') {
      plan = 'free';
    }

    await mainDb
      .updateTable('users')
      .set({
        subscription_plan: plan,
        subscription_status: status,
        subscription_current_period_end: currentPeriodEnd,
        subscription_cancel_at_period_end: cancelAtPeriodEnd,
      })
      .where('id', '=', user.id)
      .execute();

    await invalidateUserAndUsernameCache(user.id, user.username);

    return res.json({
      plan,
      subscriptionStatus: status,
      subscriptionCurrentPeriodEnd: currentPeriodEnd,
      subscriptionCancelAtPeriodEnd: cancelAtPeriodEnd,
    });
  } catch (error) {
    console.error('[Stripe] Failed to sync subscription:', error);
    return res.status(500).json({ error: 'Failed to sync subscription' });
  }
});

export default router;

