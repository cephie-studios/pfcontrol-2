import { apiError } from '../error.js';
import type { PaidPlan, PassMonths } from '../../../types/billing';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || '';

export type ChartSourceKey = 'pfatc' | 'cephie' | 'celesbit' | 'chartfox';
export type ChartSourceState = Record<ChartSourceKey, boolean>;
export type ExpenseCadence = 'month' | 'year' | 'once';

export interface AdminExpense {
  id: number;
  label: string;
  amountCents: number;
  cadence: ExpenseCadence;
  startsMonth: string;
  endsMonth: string | null;
}

export interface AdminMonthSummary {
  month: string;
  grossCents: number;
  feeCents: number;
  refundCents: number;
  netCents: number;
  expenseCents: number;
  profitCents: number;
}

export interface AdminSupporter {
  userId: string;
  username: string | null;
  avatar: string | null;
  plan: PaidPlan;
  sources: ('subscription' | 'pass' | 'gift' | 'admin')[];
  endsAt: string;
  since: string;
  interval: 'month' | 'year' | null;
  renews: boolean;
  status: string | null;
}

export interface AdminBillingOverview {
  currency: string;
  stripeConfigured: boolean;
  stripeError: string | null;
  plans: {
    supporters: number;
    subscriptions: number;
    passes: number;
  };
  monthlyRecurringCents: number;
  months: AdminMonthSummary[] | null;
  expenses: AdminExpense[];
  supporters: AdminSupporter[];
  chartSources: ChartSourceState;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    await apiError(res, `HTTP ${res.status}`);
  }
  return res.json();
}

export function fetchAdminBilling(refresh = false) {
  return request<AdminBillingOverview>(
    `/api/admin/billing${refresh ? '?refresh=1' : ''}`
  );
}

export async function setChartSourceEnabled(
  source: ChartSourceKey,
  enabled: boolean
) {
  const data = await request<{ chartSources: ChartSourceState }>(
    `/api/admin/billing/chart-sources/${source}`,
    { method: 'PUT', body: JSON.stringify({ enabled }) }
  );
  return data.chartSources;
}

export async function addAdminExpense(expense: Omit<AdminExpense, 'id'>) {
  const data = await request<{ expenses: AdminExpense[] }>(
    '/api/admin/billing/expenses',
    { method: 'POST', body: JSON.stringify(expense) }
  );
  return data.expenses;
}

export async function deleteAdminExpense(id: number) {
  const data = await request<{ expenses: AdminExpense[] }>(
    `/api/admin/billing/expenses/${id}`,
    { method: 'DELETE' }
  );
  return data.expenses;
}

export async function grantPlan(
  userId: string,
  plan: PaidPlan,
  months: PassMonths
) {
  await request('/api/admin/billing/grant', {
    method: 'POST',
    body: JSON.stringify({ userId, plan, months }),
  });
}
