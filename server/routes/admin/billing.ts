import express, { type Request } from 'express';
import { requireAdmin } from '../../middleware/admin.js';
import { logAdminAction } from '../../db/audit.js';
import { redisConnection } from '../../db/connection.js';
import {
  CHART_SOURCES,
  addExpense,
  deleteExpense,
  getActiveGrants,
  getChartSources,
  isChartSource,
  listExpenses,
  setChartSource,
} from '../../db/adminBilling.js';
import {
  isMonthKey,
  lastMonths,
  monthlyRecurringCents,
  summarizeMonths,
  type BalanceTransaction,
} from '../../billing/finance.js';
import { CURRENCY } from '../../billing/plans.js';
import { stripe } from '../../billing/stripe.js';
import { prefixKey } from '../../utils/cacheTtl.js';
import { getClientIp } from '../../utils/getIpAddress.js';

const router = express.Router();
router.use(requireAdmin);

const MONTHS = 12;
const STRIPE_CACHE_SEC = 10 * 60;
const CADENCES = ['month', 'year', 'once'] as const;

function audit(req: Request, actionType: string, details: object) {
  return logAdminAction({
    adminId: req.user!.userId,
    adminUsername: req.user!.username || 'Unknown',
    actionType,
    ipAddress: getClientIp(req),
    userAgent: req.get('User-Agent') ?? null,
    details: { ...details },
  });
}

// Stripe is the source of truth for money; cached so the page doesn't page
// through a year of transactions on every visit.
async function loadTransactions(
  since: Date,
  refresh: boolean
): Promise<BalanceTransaction[] | null> {
  if (!stripe) return null;
  const key = prefixKey(
    `admin:billing:txns:${since.toISOString().slice(0, 7)}`
  );
  if (!refresh) {
    try {
      const cached = await redisConnection.get(key);
      if (cached) return JSON.parse(cached) as BalanceTransaction[];
    } catch {
      // Fall through to Stripe.
    }
  }
  const transactions: BalanceTransaction[] = [];
  for await (const txn of stripe.balanceTransactions.list({
    created: { gte: Math.floor(since.getTime() / 1000) },
    limit: 100,
  })) {
    if (txn.currency !== CURRENCY) continue;
    transactions.push({
      created: txn.created,
      type: txn.type,
      amount: txn.amount,
      fee: txn.fee,
      net: txn.net,
    });
  }
  try {
    await redisConnection.set(
      key,
      JSON.stringify(transactions),
      'EX',
      STRIPE_CACHE_SEC
    );
  } catch {
    // Caching is best effort.
  }
  return transactions;
}

// GET: /api/admin/billing - plans, supporters, revenue and spending
router.get('/', async (req, res) => {
  const now = new Date();
  const months = lastMonths(MONTHS, now);
  const since = new Date(`${months[0]}-01T00:00:00Z`);

  const [grants, expenses, sources] = await Promise.all([
    getActiveGrants(now),
    listExpenses(),
    getChartSources(),
  ]);

  let transactions: BalanceTransaction[] | null = null;
  let stripeError: string | null = null;
  try {
    transactions = await loadTransactions(since, req.query.refresh === '1');
  } catch (error) {
    console.error('[Billing] Could not load Stripe transactions:', error);
    stripeError = 'Stripe could not be reached';
  }

  const byUser = new Map<string, (typeof grants)[number][]>();
  for (const grant of grants) {
    byUser.set(grant.userId, [...(byUser.get(grant.userId) ?? []), grant]);
  }
  const supporters = [...byUser.values()].map((userGrants) => {
    const best = userGrants[0];
    const subscription = userGrants.find((g) => g.source === 'subscription');
    return {
      userId: best.userId,
      username: best.username,
      avatar: best.avatar,
      plan: best.plan,
      sources: [...new Set(userGrants.map((g) => g.source))],
      endsAt: new Date(
        Math.max(...userGrants.map((g) => +g.endsAt))
      ).toISOString(),
      since: new Date(
        Math.min(...userGrants.map((g) => +g.startsAt))
      ).toISOString(),
      interval: subscription?.interval ?? null,
      renews: !!subscription && !subscription.cancelAtPeriodEnd,
      status: subscription?.status ?? null,
    };
  });

  const recurring = grants
    .filter((g) => g.source === 'subscription' && !g.cancelAtPeriodEnd)
    .map((g) => ({ plan: g.plan, interval: g.interval }));

  res.setHeader('Cache-Control', 'private, no-store');
  res.json({
    currency: CURRENCY,
    stripeConfigured: !!stripe,
    stripeError,
    plans: {
      supporters: supporters.length,
      subscriptions: recurring.length,
      passes: supporters.filter((s) => !s.sources.includes('subscription'))
        .length,
    },
    monthlyRecurringCents: monthlyRecurringCents(recurring),
    months: transactions
      ? summarizeMonths(months, transactions, expenses)
      : null,
    expenses,
    supporters: supporters.sort((a, b) =>
      (a.username ?? '').localeCompare(b.username ?? '')
    ),
    chartSources: sources,
  });
});

// PUT: /api/admin/billing/chart-sources/:source - turn a chart source on or off
router.put('/chart-sources/:source', async (req, res) => {
  const { source } = req.params;
  const { enabled } = (req.body ?? {}) as { enabled?: unknown };
  if (!isChartSource(source) || typeof enabled !== 'boolean') {
    return res.status(400).json({
      error: `source must be one of ${CHART_SOURCES.join(', ')} and enabled a boolean`,
    });
  }
  const sources = await setChartSource(source, enabled, req.user!.userId);
  await audit(req, 'CHART_SOURCE_UPDATED', { source, enabled });
  res.json({ chartSources: sources });
});

// POST: /api/admin/billing/expenses - record a cost (servers, domains, ...)
router.post('/expenses', async (req, res) => {
  const { label, amountCents, cadence, startsMonth, endsMonth } = (req.body ??
    {}) as Record<string, unknown>;
  const name = typeof label === 'string' ? label.trim() : '';
  if (
    !name ||
    name.length > 120 ||
    !Number.isInteger(amountCents) ||
    (amountCents as number) <= 0 ||
    !CADENCES.includes(cadence as (typeof CADENCES)[number]) ||
    !isMonthKey(startsMonth) ||
    (endsMonth != null && (!isMonthKey(endsMonth) || endsMonth < startsMonth))
  ) {
    return res.status(400).json({ error: 'Invalid expense' });
  }
  const expense = {
    label: name,
    amountCents: amountCents as number,
    cadence: cadence as (typeof CADENCES)[number],
    startsMonth,
    endsMonth: (endsMonth as string | null | undefined) ?? null,
  };
  await addExpense(expense, req.user!.userId);
  await audit(req, 'BILLING_EXPENSE_ADDED', expense);
  res.status(201).json({ expenses: await listExpenses() });
});

// DELETE: /api/admin/billing/expenses/:id
router.delete('/expenses/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || !(await deleteExpense(id))) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  await audit(req, 'BILLING_EXPENSE_DELETED', { id });
  res.json({ expenses: await listExpenses() });
});

export default router;
