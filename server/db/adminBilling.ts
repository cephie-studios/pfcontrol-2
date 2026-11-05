import { mainDb } from './connection.js';
import type { Expense, ExpenseCadence } from '../billing/finance.js';
import type { BillingInterval, PaidPlan } from '../billing/plans.js';

export const CHART_SOURCES = [
  'pfatc',
  'cephie',
  'celesbit',
  'chartfox',
] as const;
export type ChartSource = (typeof CHART_SOURCES)[number];
export type ChartSourceState = Record<ChartSource, boolean>;

export function isChartSource(value: unknown): value is ChartSource {
  return CHART_SOURCES.includes(value as ChartSource);
}

const SOURCE_CACHE_MS = 30_000;
let sourceCache: { state: ChartSourceState; at: number } | null = null;

export async function getChartSources(): Promise<ChartSourceState> {
  if (sourceCache && Date.now() - sourceCache.at < SOURCE_CACHE_MS) {
    return sourceCache.state;
  }
  const state = Object.fromEntries(
    CHART_SOURCES.map((source) => [source, true])
  ) as ChartSourceState;
  try {
    const rows = await mainDb
      .selectFrom('chart_source_settings')
      .select(['source', 'enabled'])
      .execute();
    for (const row of rows) {
      if (isChartSource(row.source)) state[row.source] = row.enabled;
    }
  } catch (error) {
    // Fail open: a settings outage shouldn't take every chart offline.
    console.error('[Charts] Could not read chart sources:', error);
    return state;
  }
  sourceCache = { state, at: Date.now() };
  return state;
}

export async function isChartSourceEnabled(source: ChartSource) {
  return (await getChartSources())[source];
}

export async function setChartSource(
  source: ChartSource,
  enabled: boolean,
  updatedBy: string
): Promise<ChartSourceState> {
  await mainDb
    .insertInto('chart_source_settings')
    .values({ source, enabled, updated_by: updatedBy })
    .onConflict((oc) =>
      oc
        .column('source')
        .doUpdateSet({ enabled, updated_by: updatedBy, updated_at: new Date() })
    )
    .execute();
  sourceCache = null;
  return getChartSources();
}

export async function listExpenses(): Promise<Expense[]> {
  const rows = await mainDb
    .selectFrom('billing_expenses')
    .selectAll()
    .orderBy('starts_month', 'desc')
    .orderBy('id', 'desc')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    amountCents: row.amount_cents,
    cadence: row.cadence,
    startsMonth: row.starts_month,
    endsMonth: row.ends_month,
  }));
}

export async function addExpense(
  expense: {
    label: string;
    amountCents: number;
    cadence: ExpenseCadence;
    startsMonth: string;
    endsMonth: string | null;
  },
  createdBy: string
) {
  await mainDb
    .insertInto('billing_expenses')
    .values({
      label: expense.label,
      amount_cents: expense.amountCents,
      cadence: expense.cadence,
      starts_month: expense.startsMonth,
      ends_month: expense.endsMonth,
      created_by: createdBy,
    })
    .execute();
}

export async function deleteExpense(id: number): Promise<boolean> {
  const result = await mainDb
    .deleteFrom('billing_expenses')
    .where('id', '=', id)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

export interface ActiveGrantRow {
  userId: string;
  username: string | null;
  avatar: string | null;
  plan: PaidPlan;
  source: 'subscription' | 'pass' | 'gift' | 'admin';
  startsAt: Date;
  endsAt: Date;
  interval: BillingInterval | null;
  cancelAtPeriodEnd: boolean;
  status: string | null;
}

export async function getActiveGrants(now: Date): Promise<ActiveGrantRow[]> {
  const rows = await mainDb
    .selectFrom('plan_grants as g')
    .leftJoin('users as u', 'u.id', 'g.user_id')
    .select([
      'g.user_id',
      'u.username',
      'u.avatar',
      'g.plan',
      'g.source',
      'g.starts_at',
      'g.ends_at',
      'g.billing_interval',
      'g.cancel_at_period_end',
      'g.subscription_status',
    ])
    .where('g.starts_at', '<=', now)
    .where('g.ends_at', '>', now)
    .execute();
  return rows.map((row) => ({
    userId: row.user_id,
    username: row.username ?? null,
    avatar: row.avatar ?? null,
    plan: row.plan,
    source: row.source,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    interval: row.billing_interval,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    status: row.subscription_status,
  }));
}
