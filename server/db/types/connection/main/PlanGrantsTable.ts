import type { Generated } from 'kysely';

export interface PlanGrantsTable {
  id: Generated<number>;
  user_id: string;
  plan: 'supporter';
  source: 'subscription' | 'pass' | 'gift' | 'admin';
  starts_at: Date;
  ends_at: Date;
  stripe_subscription_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  subscription_status: string | null;
  billing_interval: 'month' | 'year' | null;
  cancel_at_period_end: boolean | null;
  gifted_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}
