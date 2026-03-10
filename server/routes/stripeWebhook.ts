import express from 'express';
import { stripe } from '../lib/stripe.js';
import { mainDb } from '../db/connection.js';
import { invalidateUserAndUsernameCache } from '../db/users.js';
import Stripe from 'stripe';

const router = express.Router();

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      console.warn(
        '[Stripe] Webhook endpoint called but Stripe or STRIPE_WEBHOOK_SECRET is not configured.'
      );
      return res.status(503).send('Stripe not configured');
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).send('Missing Stripe-Signature header');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[Stripe] Webhook signature verification failed:', err);
      return res.status(400).send('Webhook Error');
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          await handleSubscriptionEvent(event);
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.error('[Stripe] Error handling webhook event:', error);
      // still return 200 to avoid repeated retries if our internal handling fails
    }

    res.json({ received: true });
  }
);

async function handleSubscriptionEvent(event: Stripe.Event) {
  if (!stripe) return;

  let subscription: Stripe.Subscription | null = null;

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (!session.subscription) return;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } else {
    subscription = event.data.object as Stripe.Subscription;
  }

  if (!subscription) return;

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const customer = await stripe.customers.retrieve(customerId);

  let userId: string | null = null;
  if (
    customer &&
    !('deleted' in customer) &&
    customer.metadata &&
    typeof customer.metadata.pfcontrolUserId === 'string'
  ) {
    userId = customer.metadata.pfcontrolUserId;
  }

  if (!userId) {
    console.warn(
      '[Stripe] Subscription event without pfcontrolUserId metadata. customer=',
      customerId
    );
    return;
  }

  const price = subscription.items.data[0]?.price;
  let plan: 'free' | 'basic' | 'ultimate' | null = null;

  if (price?.id && price.id === process.env.STRIPE_BASIC_PRICE_ID) {
    plan = 'basic';
  } else if (
    price?.id &&
    price.id === process.env.STRIPE_ULTIMATE_PRICE_ID
  ) {
    plan = 'ultimate';
  }

  const status = subscription.status;

  const rawCurrentPeriodEnd = (subscription as any)
    .current_period_end as number | undefined | null;
  const currentPeriodEnd =
    typeof rawCurrentPeriodEnd === 'number'
      ? new Date(rawCurrentPeriodEnd * 1000)
      : null;

  const rawCancelAtPeriodEnd = (subscription as any)
    .cancel_at_period_end as boolean | undefined | null;
  const cancelAtPeriodEnd =
    typeof rawCancelAtPeriodEnd === 'boolean' ? rawCancelAtPeriodEnd : null;

  await mainDb
    .updateTable('users')
    .set({
      subscription_plan: plan,
      subscription_status: status,
      subscription_current_period_end: currentPeriodEnd,
      subscription_cancel_at_period_end: cancelAtPeriodEnd,
    })
    .where('stripe_customer_id', '=', customerId)
    .execute();

  await invalidateUserAndUsernameCache(userId);
}

export default router;
