import { describe, expect, it } from 'vitest';
import {
  expenseForMonth,
  isMonthKey,
  lastMonths,
  monthlyRecurringCents,
  summarizeMonths,
  type Expense,
} from '../../../server/billing/finance.js';

const expense = (overrides: Partial<Expense>): Expense => ({
  id: 1,
  label: 'Server',
  amountCents: 1200,
  cadence: 'month',
  startsMonth: '2026-03',
  endsMonth: null,
  ...overrides,
});

const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe('finance', () => {
  it('lists the last months oldest first', () => {
    expect(lastMonths(3, new Date('2026-01-15T00:00:00Z'))).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });

  it('validates month keys', () => {
    expect(isMonthKey('2026-10')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-1')).toBe(false);
  });

  it('applies expenses by cadence and date range', () => {
    expect(expenseForMonth(expense({}), '2026-02')).toBe(0);
    expect(expenseForMonth(expense({}), '2026-03')).toBe(1200);
    expect(expenseForMonth(expense({ endsMonth: '2026-05' }), '2026-06')).toBe(
      0
    );
    expect(expenseForMonth(expense({ cadence: 'year' }), '2026-08')).toBe(100);
    expect(expenseForMonth(expense({ cadence: 'once' }), '2026-03')).toBe(1200);
    expect(expenseForMonth(expense({ cadence: 'once' }), '2026-04')).toBe(0);
  });

  it('sums Stripe transactions into months', () => {
    const [row] = summarizeMonths(
      ['2026-10'],
      [
        {
          created: at('2026-10-02T10:00:00Z'),
          type: 'charge',
          amount: 300,
          fee: 39,
          net: 261,
        },
        {
          created: at('2026-10-03T10:00:00Z'),
          type: 'refund',
          amount: -100,
          fee: 0,
          net: -100,
        },
        {
          created: at('2026-10-04T10:00:00Z'),
          type: 'stripe_fee',
          amount: -50,
          fee: 0,
          net: -50,
        },
        {
          created: at('2026-09-30T10:00:00Z'),
          type: 'charge',
          amount: 999,
          fee: 0,
          net: 999,
        },
      ],
      [expense({ amountCents: 61 })]
    );
    expect(row).toEqual({
      month: '2026-10',
      grossCents: 300,
      feeCents: 89,
      refundCents: 100,
      netCents: 111,
      expenseCents: 61,
      profitCents: 50,
    });
  });

  it('estimates monthly recurring revenue', () => {
    expect(
      monthlyRecurringCents([
        { plan: 'supporter', interval: 'month' },
        { plan: 'supporter', interval: 'year' },
      ])
    ).toBe(100 + 83);
  });
});
