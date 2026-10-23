import Stripe from 'stripe';
import {
  CURRENCY,
  PAID_PLANS,
  PASS_MONTHS,
  PLAN_NAMES,
  PRICES,
  passAmount,
  passLookupKey,
  subscriptionLookupKey,
  type BillingInterval,
  type PaidPlan,
} from './plans.js';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
export const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? '';

export const stripe = SECRET_KEY ? new Stripe(SECRET_KEY) : null;

export function isBillingEnabled(): boolean {
  return !!stripe && !!WEBHOOK_SECRET;
}

interface PriceSpec {
  lookupKey: string;
  plan: PaidPlan;
  amount: number;
  interval: BillingInterval | null;
  nickname: string;
}

function priceSpecs(): PriceSpec[] {
  return PAID_PLANS.flatMap((plan) => [
    ...(['month', 'year'] as const).map((interval) => ({
      lookupKey: subscriptionLookupKey(plan, interval),
      plan,
      amount: PRICES[plan][interval],
      interval,
      nickname: `${PLAN_NAMES[plan]} ${interval}ly`,
    })),
    ...PASS_MONTHS.map((months) => ({
      lookupKey: passLookupKey(plan, months),
      plan,
      amount: passAmount(plan, months),
      interval: null,
      nickname: `${PLAN_NAMES[plan]} ${months}-month pass`,
    })),
  ]);
}

async function ensureProduct(client: Stripe, plan: PaidPlan): Promise<string> {
  const id = `pfcontrol_${plan}`;
  try {
    await client.products.retrieve(id);
  } catch (error) {
    if ((error as { code?: string }).code !== 'resource_missing') throw error;
    await client.products.create({
      id,
      name: `PFControl ${PLAN_NAMES[plan]}`,
      metadata: { plan },
    });
  }
  return id;
}

// Prices are created from plans.ts on first use, so a new Stripe account only
// needs the secret key and a webhook. Changing an amount creates a new price
// and moves the lookup key over to it.
async function provisionPrices(client: Stripe): Promise<Map<string, string>> {
  const specs = priceSpecs();
  const existing = new Map<string, Stripe.Price>();
  for (let i = 0; i < specs.length; i += 10) {
    const page = await client.prices.list({
      lookup_keys: specs.slice(i, i + 10).map((s) => s.lookupKey),
      active: true,
      limit: 10,
    });
    for (const price of page.data)
      if (price.lookup_key) existing.set(price.lookup_key, price);
  }

  const ids = new Map<string, string>();
  for (const spec of specs) {
    const current = existing.get(spec.lookupKey);
    if (
      current &&
      current.unit_amount === spec.amount &&
      current.currency === CURRENCY
    ) {
      ids.set(spec.lookupKey, current.id);
      continue;
    }
    const price = await client.prices.create({
      product: await ensureProduct(client, spec.plan),
      currency: CURRENCY,
      unit_amount: spec.amount,
      nickname: spec.nickname,
      lookup_key: spec.lookupKey,
      transfer_lookup_key: true,
      metadata: { plan: spec.plan },
      ...(spec.interval ? { recurring: { interval: spec.interval } } : {}),
    });
    ids.set(spec.lookupKey, price.id);
  }
  return ids;
}

let pricesPromise: Promise<Map<string, string>> | null = null;

export async function priceIdFor(lookupKey: string): Promise<string> {
  if (!stripe) throw new Error('Stripe is not configured');
  pricesPromise ??= provisionPrices(stripe).catch((error) => {
    pricesPromise = null;
    throw error;
  });
  const id = (await pricesPromise).get(lookupKey);
  if (!id) throw new Error(`No Stripe price for ${lookupKey}`);
  return id;
}
