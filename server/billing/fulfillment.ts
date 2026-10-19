import type Stripe from 'stripe';
import {
  insertQueuedPass,
  revokeGrantsForPayment,
  upsertSubscriptionGrant,
} from '../db/billing.js';
import { getUserById } from '../db/users.js';
import { createUserNotification } from '../db/userNotifications.js';
import { invalidatePlan } from './entitlements.js';
import {
  PLAN_NAMES,
  isPaidPlan,
  passWindow,
  type PassMonths,
  isPassMonths,
} from './plans.js';
import { stripe } from './stripe.js';

const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

export async function syncSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata.userId;
  const item = sub.items.data[0];
  const plan = item?.price.metadata.plan ?? sub.metadata.plan;
  if (!userId || !item || !isPaidPlan(plan)) {
    console.warn(`[Billing] Ignoring subscription ${sub.id} without a plan`);
    return;
  }

  const startsAt = new Date(sub.start_date * 1000);
  let endsAt = new Date(item.current_period_end * 1000);
  if (sub.status === 'incomplete') endsAt = startsAt;
  else if (!LIVE_STATUSES.has(sub.status)) {
    endsAt = sub.ended_at ? new Date(sub.ended_at * 1000) : new Date();
  }

  await upsertSubscriptionGrant({
    userId,
    plan,
    subscriptionId: sub.id,
    status: sub.status,
    interval: item.price.recurring?.interval === 'year' ? 'year' : 'month',
    startsAt,
    endsAt,
    cancelAtPeriodEnd: sub.cancel_at_period_end || sub.cancel_at != null,
  });
  await invalidatePlan(userId);
}

async function fulfillPass(session: Stripe.Checkout.Session) {
  const { recipientId, buyerId, plan } = session.metadata ?? {};
  const months = Number(session.metadata?.months);
  if (!recipientId || !isPaidPlan(plan) || !isPassMonths(months)) {
    console.warn(`[Billing] Checkout ${session.id} has no pass metadata`);
    return;
  }

  const isGift = buyerId !== recipientId;
  const paymentIntent =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const granted = await insertQueuedPass({
    userId: recipientId,
    plan,
    source: isGift ? 'gift' : 'pass',
    window: (queued) =>
      passWindow(queued, plan, months as PassMonths, new Date()),
    checkoutSessionId: session.id,
    paymentIntentId: paymentIntent,
    giftedBy: isGift ? (buyerId ?? null) : null,
  });
  if (!granted) return;
  await invalidatePlan(recipientId);

  const gifter = isGift && buyerId ? await getUserById(buyerId) : null;
  const from = gifter?.username ?? 'Someone';
  const length = months === 1 ? '1 month' : `${months} months`;
  await createUserNotification({
    userId: recipientId,
    type: 'billing',
    title: isGift
      ? `${from} gifted you ${PLAN_NAMES[plan]}!`
      : `${PLAN_NAMES[plan]} is active`,
    message: isGift
      ? `You got ${length} of PFControl ${PLAN_NAMES[plan]}. Your perks are live now.`
      : `Thanks for supporting PFControl! Your ${length} of ${PLAN_NAMES[plan]} has been added.`,
  });
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      if (session.mode === 'payment' && session.payment_status === 'paid') {
        await fulfillPass(session);
      }
      if (session.mode === 'subscription' && session.subscription && stripe) {
        const id =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
        await syncSubscription(await stripe.subscriptions.retrieve(id));
      }
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(event.data.object);
      return;
    case 'charge.refunded':
    case 'charge.dispute.created': {
      const object = event.data.object;
      if (event.type === 'charge.refunded' && !event.data.object.refunded)
        return;
      const intent =
        typeof object.payment_intent === 'string'
          ? object.payment_intent
          : object.payment_intent?.id;
      if (!intent) return;
      for (const userId of await revokeGrantsForPayment(intent)) {
        await invalidatePlan(userId);
      }
      return;
    }
    default:
      return;
  }
}
