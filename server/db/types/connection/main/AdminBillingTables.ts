import type { Generated } from 'kysely';

export interface ChartSourceSettingsTable {
  source: string;
  enabled: boolean;
  updated_by: string | null;
  updated_at: Generated<Date>;
}

export interface BillingExpensesTable {
  id: Generated<number>;
  label: string;
  amount_cents: number;
  cadence: 'month' | 'year' | 'once';
  starts_month: string;
  ends_month: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
}
