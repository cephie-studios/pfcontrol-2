import { apiFetch } from '../apiFetch.js';
import { apiError } from './error.js';
import type {
  BillingCatalog,
  CheckoutRequest,
  GiftRecipient,
  MyPlan,
  SupporterPrefs,
} from '../../types/billing';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export async function fetchBillingCatalog(): Promise<BillingCatalog> {
  const res = await apiFetch(`${API_BASE_URL}/api/billing/catalog`);
  if (!res.ok) await apiError(res, 'Failed to load plans');
  const catalog = (await res.json()) as BillingCatalog;
  // A cached catalog from before the plans were merged has no supporter plan.
  if (!catalog.plans?.supporter || !catalog.limits?.supporter) {
    throw new Error('Failed to load plans');
  }
  return catalog;
}

export async function fetchMyPlan(): Promise<MyPlan> {
  const res = await apiFetch(`${API_BASE_URL}/api/billing/me`, {
    credentials: 'include',
  });
  if (!res.ok) await apiError(res, 'Failed to load your plan');
  return res.json();
}

export async function updateSupporterPrefs(
  prefs: Partial<SupporterPrefs>
): Promise<SupporterPrefs> {
  const res = await apiFetch(`${API_BASE_URL}/api/billing/me/prefs`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) await apiError(res, 'Failed to save');
  return (await res.json()).prefs;
}

export async function fetchGiftRecipient(
  username: string
): Promise<GiftRecipient> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/billing/recipient/${encodeURIComponent(username)}`
  );
  if (!res.ok) await apiError(res, 'Pilot not found');
  return res.json();
}

export async function startCheckout(request: CheckoutRequest): Promise<string> {
  const res = await apiFetch(`${API_BASE_URL}/api/billing/checkout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, consent: true }),
  });
  if (!res.ok) await apiError(res, 'Could not start checkout');
  return (await res.json()).url;
}

export async function openBillingPortal(): Promise<string> {
  const res = await apiFetch(`${API_BASE_URL}/api/billing/portal`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) await apiError(res, 'Could not open billing');
  return (await res.json()).url;
}
