import { PRICES, type BillingInterval, type PaidPlan } from './plans.js';

export type ExpenseCadence = 'month' | 'year' | 'once';

export interface Expense {
  id: number;
  label: string;
  amountCents: number;
  cadence: ExpenseCadence;
  startsMonth: string;
  endsMonth: string | null;
}

export interface MonthSummary {
  month: string;
  grossCents: number;
  feeCents: number;
  refundCents: number;
  netCents: number;
  expenseCents: number;
  profitCents: number;
}

export interface BalanceTransaction {
  created: number;
  type: string;
  amount: number;
  fee: number;
  net: number;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && MONTH.test(value);
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function lastMonths(count: number, now: Date): string[] {
  return Array.from({ length: count }, (_, i) =>
    monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)))
  ).reverse();
}

export function expenseForMonth(expense: Expense, month: string): number {
  if (month < expense.startsMonth) return 0;
  if (expense.endsMonth && month > expense.endsMonth) return 0;
  if (expense.cadence === 'once') {
    return month === expense.startsMonth ? expense.amountCents : 0;
  }
  if (expense.cadence === 'year') return Math.round(expense.amountCents / 12);
  return expense.amountCents;
}

const REVENUE_TYPES = new Set(['charge', 'payment']);
const REFUND_TYPES = new Set(['refund', 'payment_refund']);

export function summarizeMonths(
  months: string[],
  transactions: BalanceTransaction[],
  expenses: Expense[]
): MonthSummary[] {
  const byMonth = new Map(
    months.map((month) => [
      month,
      { month, grossCents: 0, feeCents: 0, refundCents: 0, netCents: 0 },
    ])
  );
  for (const txn of transactions) {
    const row = byMonth.get(monthKey(new Date(txn.created * 1000)));
    if (!row) continue;
    if (REVENUE_TYPES.has(txn.type)) row.grossCents += txn.amount;
    else if (REFUND_TYPES.has(txn.type)) row.refundCents += -txn.amount;
    row.feeCents += txn.fee;
    if (txn.type === 'stripe_fee') row.feeCents += -txn.amount;
    row.netCents += txn.net;
  }
  return months.map((month) => {
    const row = byMonth.get(month)!;
    const expenseCents = expenses.reduce(
      (sum, expense) => sum + expenseForMonth(expense, month),
      0
    );
    return { ...row, expenseCents, profitCents: row.netCents - expenseCents };
  });
}

export function monthlyRecurringCents(
  subscriptions: { plan: PaidPlan; interval: BillingInterval | null }[]
): number {
  return subscriptions.reduce((sum, { plan, interval }) => {
    if (interval === 'year') return sum + Math.round(PRICES[plan].year / 12);
    return sum + PRICES[plan].month;
  }, 0);
}
