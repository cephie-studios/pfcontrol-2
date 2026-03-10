import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_BASIC_PRICE_ID = process.env.STRIPE_BASIC_PRICE_ID;
const STRIPE_ULTIMATE_PRICE_ID = process.env.STRIPE_ULTIMATE_PRICE_ID;

if (!STRIPE_SECRET_KEY) {
  console.warn(
    '[Stripe] STRIPE_SECRET_KEY is not set. Stripe subscription features will be disabled.'
  );
}

export const stripe =
  STRIPE_SECRET_KEY != null && STRIPE_SECRET_KEY !== ''
    ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
    })
    : null;

export type StripePlanTier = 'free' | 'basic' | 'ultimate';

export function getPriceIdForTier(tier: StripePlanTier): string | null {
  if (tier === 'basic') return STRIPE_BASIC_PRICE_ID ?? null;
  if (tier === 'ultimate') return STRIPE_ULTIMATE_PRICE_ID ?? null;
  return null;
}

export function formatStripeAmount(
  unitAmount: number | null | undefined,
  currency: string | null | undefined
): string | null {
  if (unitAmount == null || currency == null) return null;
  const amount = unitAmount / 100;
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
}