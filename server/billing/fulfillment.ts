import type Stripe from 'stripe';
import {
  getStripeCustomerId,
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
import { subscriptionWindow } from './subscriptionWindow.js';

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === 'string' ? value : (value?.id ?? null);

export async function syncSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata.userId;
  const item = sub.items.data[0];
  const plan = item?.price.metadata.plan ?? sub.metadata.plan;
  if (!userId || !item || !isPaidPlan(plan)) {
    console.warn(`[Billing] Ignoring subscription ${sub.id} without a plan`);
    return;
  }

  const customerId = idOf(sub.customer);
  if (!customerId || customerId !== (await getStripeCustomerId(userId))) {
    console.error(
      `[Billing] Subscription ${sub.id} does not belong to the customer of user ${userId}`
    );
    return;
  }

  const { startsAt, endsAt } = subscriptionWindow(sub, item, new Date());
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

async function syncSubscriptionById(id: string) {
  if (!stripe) return;
  await syncSubscription(await stripe.subscriptions.retrieve(id));
}

async function fulfillPass(session: Stripe.Checkout.Session) {
  const { recipientId, buyerId, plan } = session.metadata ?? {};
  const months = Number(session.metadata?.months);
  if (!recipientId || !isPaidPlan(plan) || !isPassMonths(months)) {
    console.warn(`[Billing] Checkout ${session.id} has no pass metadata`);
    return;
  }
  if (!(await getUserById(recipientId))) {
    console.error(
      `[Billing] Checkout ${session.id} was paid for ${recipientId}, who no longer exists; refund it`
    );
    return;
  }

  const isGift = buyerId !== recipientId;

  const granted = await insertQueuedPass({
    userId: recipientId,
    plan,
    source: isGift ? 'gift' : 'pass',
    window: (queued) =>
      passWindow(queued, plan, months as PassMonths, new Date()),
    checkoutSessionId: session.id,
    paymentIntentId: idOf(session.payment_intent),
    giftedBy: isGift ? buyerId || null : null,
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

async function subscriptionBehindPayment(intent: string) {
  if (!stripe) return null;
  const { data } = await stripe.invoicePayments.list({
    payment: { type: 'payment_intent', payment_intent: intent },
    expand: ['data.invoice'],
    limit: 1,
  });
  const invoice = data[0]?.invoice;
  if (!invoice || typeof invoice === 'string' || invoice.deleted) return null;
  const id = idOf(invoice.parent?.subscription_details?.subscription);
  return id ? { id, invoiceId: invoice.id } : null;
}

// Subscription grants carry no payment intent, so a refunded or disputed
// renewal is cut off by cancelling the subscription itself. A refund only
// counts when it is for the latest invoice; a dispute always does.
async function revokePayment(intent: string, requireLatestInvoice: boolean) {
  for (const userId of await revokeGrantsForPayment(intent)) {
    await invalidatePlan(userId);
  }
  const behind = await subscriptionBehindPayment(intent);
  if (!behind || !stripe) return;
  const sub = await stripe.subscriptions.retrieve(behind.id);
  if (sub.status === 'canceled') return;
  if (requireLatestInvoice && idOf(sub.latest_invoice) !== behind.invoiceId) {
    return;
  }
  await syncSubscription(await stripe.subscriptions.cancel(behind.id));
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      if (session.mode === 'payment' && session.payment_status === 'paid') {
        await fulfillPass(session);
      }
      const subscription = idOf(session.subscription);
      if (session.mode === 'subscription' && subscription) {
        await syncSubscriptionById(subscription);
      }
      return;
    }
    // The event payload can be stale or out of order across retries, so the
    // subscription is always re-read from Stripe.
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscriptionById(event.data.object.id);
      return;
    case 'charge.refunded': {
      const charge = event.data.object;
      const intent = idOf(charge.payment_intent);
      if (charge.refunded && intent) await revokePayment(intent, true);
      return;
    }
    case 'charge.dispute.created': {
      const intent = idOf(event.data.object.payment_intent);
      if (intent) await revokePayment(intent, false);
      return;
    }
    default:
      return;
  }
}
