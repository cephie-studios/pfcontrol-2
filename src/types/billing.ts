export type PaidPlan = 'supporter';
export type Plan = 'free' | PaidPlan;
export type BillingInterval = 'month' | 'year';
export type PassMonths = 1 | 3 | 12;
export type SupporterRing = 'plan' | 'aurora' | 'sunset' | 'radar' | 'custom';

export interface PlanPrices {
  month: number;
  year: number;
  passes: Record<PassMonths, number>;
}

export interface WallSupporter {
  id: string;
  username: string;
  avatar: string | null;
  plan: PaidPlan;
}

export interface PlanLimits {
  maxSessions: number;
  featuredFlights: number;
  snapsPerFlight: number;
  animatedBackgrounds: boolean;
}

export interface BillingCatalog {
  enabled: boolean;
  currency: string;
  plans: Record<PaidPlan, PlanPrices>;
  limits: Record<Plan, PlanLimits>;
  supporters: { count: number; wall: WallSupporter[] };
}

export interface SupporterPrefs {
  wall: boolean;
  ring: SupporterRing;
  colors: string[];
}

export interface MyPlan {
  plan: Plan;
  supporterPlan: Plan;
  staffAccess: boolean;
  supporterMonths: number;
  supporterSince: string | null;
  subscription: {
    plan: PaidPlan;
    status: string;
    interval: BillingInterval | null;
    renewsAt: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  passEndsAt: string | null;
  prefs: SupporterPrefs;
  billingEnabled: boolean;
  canManageBilling: boolean;
}

export interface SupporterBadge {
  plan: PaidPlan;
  months: number;
  since: string | null;
  ring: SupporterRing;
}

export interface AvatarRing {
  plan: PaidPlan;
  ring: SupporterRing;
  colors?: string[];
}

export interface GiftRecipient {
  id: string;
  username: string;
  avatar: string | null;
  plan: Plan;
}

export type CheckoutRequest =
  | { kind: 'subscription'; plan: PaidPlan; interval: BillingInterval }
  | { kind: 'pass'; plan: PaidPlan; months: PassMonths; recipient?: string };
