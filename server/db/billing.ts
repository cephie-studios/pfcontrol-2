import { sql } from 'kysely';
import { mainDb } from './connection.js';
import type {
  BillingInterval,
  Grant,
  GrantSource,
  PaidPlan,
  SupporterRing,
} from '../billing/plans.js';
import {
  DEFAULT_RING_COLORS,
  SUPPORTER_RINGS,
  isRingColors,
} from '../billing/plans.js';

export interface PlanGrant extends Grant {
  id: number;
  source: GrantSource;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  interval: BillingInterval | null;
  cancelAtPeriodEnd: boolean;
  giftedBy: string | null;
}

export interface SupporterPrefs {
  wall: boolean;
  ring: SupporterRing;
  colors: string[];
}

export function readSupporterPrefs(raw: unknown): SupporterPrefs {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    wall: value.wall === true,
    ring: SUPPORTER_RINGS.includes(value.ring as SupporterRing)
      ? (value.ring as SupporterRing)
      : 'plan',
    colors: isRingColors(value.colors)
      ? value.colors.map((c) => c.toLowerCase())
      : DEFAULT_RING_COLORS,
  };
}

export async function getPlanGrants(userId: string): Promise<PlanGrant[]> {
  const rows = await mainDb
    .selectFrom('plan_grants')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('starts_at', 'asc')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    plan: row.plan,
    source: row.source,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    subscriptionId: row.stripe_subscription_id,
    subscriptionStatus: row.subscription_status,
    interval: row.billing_interval,
    cancelAtPeriodEnd: row.cancel_at_period_end ?? false,
    giftedBy: row.gifted_by,
  }));
}

export async function upsertSubscriptionGrant(grant: {
  userId: string;
  plan: PaidPlan;
  subscriptionId: string;
  status: string;
  interval: BillingInterval | null;
  startsAt: Date;
  endsAt: Date;
  cancelAtPeriodEnd: boolean;
}): Promise<void> {
  const values = {
    plan: grant.plan,
    starts_at: grant.startsAt,
    ends_at: grant.endsAt,
    subscription_status: grant.status,
    billing_interval: grant.interval,
    cancel_at_period_end: grant.cancelAtPeriodEnd,
  };
  await mainDb
    .insertInto('plan_grants')
    .values({
      ...values,
      user_id: grant.userId,
      source: 'subscription',
      stripe_subscription_id: grant.subscriptionId,
    })
    .onConflict((oc) =>
      oc
        .column('stripe_subscription_id')
        .doUpdateSet({ ...values, updated_at: sql`now()` })
    )
    .execute();
}

// Returns false when this checkout was already granted (webhook retries).
// The user row lock keeps two passes paid at the same moment from being
// queued into the same window.
export async function insertQueuedPass(grant: {
  userId: string;
  plan: PaidPlan;
  source: 'pass' | 'gift' | 'admin';
  window: (queued: Grant[]) => { startsAt: Date; endsAt: Date };
  checkoutSessionId: string | null;
  paymentIntentId: string | null;
  giftedBy: string | null;
}): Promise<boolean> {
  return mainDb.transaction().execute(async (trx) => {
    await trx
      .selectFrom('users')
      .select('id')
      .where('id', '=', grant.userId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (grant.checkoutSessionId) {
      const seen = await trx
        .selectFrom('plan_grants')
        .select('id')
        .where('stripe_checkout_session_id', '=', grant.checkoutSessionId)
        .executeTakeFirst();
      if (seen) return false;
    }
    const queued = await trx
      .selectFrom('plan_grants')
      .select(['plan', 'starts_at', 'ends_at'])
      .where('user_id', '=', grant.userId)
      .where('source', '!=', 'subscription')
      .execute();
    const { startsAt, endsAt } = grant.window(
      queued.map((row) => ({
        plan: row.plan,
        startsAt: new Date(row.starts_at),
        endsAt: new Date(row.ends_at),
      }))
    );
    await trx
      .insertInto('plan_grants')
      .values({
        user_id: grant.userId,
        plan: grant.plan,
        source: grant.source,
        starts_at: startsAt,
        ends_at: endsAt,
        stripe_checkout_session_id: grant.checkoutSessionId,
        stripe_payment_intent_id: grant.paymentIntentId,
        gifted_by: grant.giftedBy,
      })
      .execute();
    return true;
  });
}

export async function revokeGrantsForPayment(
  paymentIntentId: string
): Promise<string[]> {
  const rows = await mainDb
    .updateTable('plan_grants')
    .set({ ends_at: sql`LEAST(ends_at, now())`, updated_at: sql`now()` })
    .where('stripe_payment_intent_id', '=', paymentIntentId)
    .returning('user_id')
    .execute();
  return rows.map((row) => row.user_id);
}

export async function getStripeCustomerId(
  userId: string
): Promise<string | null> {
  const row = await mainDb
    .selectFrom('users')
    .select('stripe_customer_id')
    .where('id', '=', userId)
    .executeTakeFirst();
  return row?.stripe_customer_id ?? null;
}

export async function setStripeCustomerId(
  userId: string,
  customerId: string
): Promise<void> {
  await mainDb
    .updateTable('users')
    .set({ stripe_customer_id: customerId })
    .where('id', '=', userId)
    .execute();
}

export async function getSupporterPrefs(
  userId: string
): Promise<SupporterPrefs> {
  const row = await mainDb
    .selectFrom('users')
    .select('supporter_prefs')
    .where('id', '=', userId)
    .executeTakeFirst();
  return readSupporterPrefs(row?.supporter_prefs);
}

export async function setSupporterPrefs(
  userId: string,
  prefs: SupporterPrefs
): Promise<void> {
  await mainDb
    .updateTable('users')
    .set({ supporter_prefs: JSON.stringify(prefs) })
    .where('id', '=', userId)
    .execute();
}

export interface WallSupporter {
  id: string;
  username: string;
  avatar: string | null;
  plan: PaidPlan;
}

export async function getActiveSupporters(limit: number): Promise<{
  count: number;
  wall: WallSupporter[];
}> {
  const active = mainDb
    .selectFrom('plan_grants')
    .select(['user_id', sql<PaidPlan>`max(plan)`.as('plan')])
    .where('starts_at', '<=', sql<Date>`now()`)
    .where('ends_at', '>', sql<Date>`now()`)
    .groupBy('user_id');

  const [countRow, wall] = await Promise.all([
    mainDb
      .selectFrom(active.as('a'))
      .select(sql<string>`count(*)`.as('count'))
      .executeTakeFirst(),
    mainDb
      .selectFrom(active.as('a'))
      .innerJoin('users as u', 'u.id', 'a.user_id')
      .select(['u.id', 'u.username', 'u.avatar', 'a.plan'])
      .where(sql<boolean>`(u.supporter_prefs->>'wall')::boolean IS TRUE`)
      .orderBy('u.username')
      .limit(limit)
      .execute(),
  ]);

  return {
    count: Number(countRow?.count ?? 0),
    wall: wall.map((row) => ({
      id: row.id,
      username: row.username,
      avatar: row.avatar ?? null,
      plan: row.plan,
    })),
  };
}
