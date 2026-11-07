import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { formatPrice } from '@/lib/plans';
import { fetchCheckoutNudge } from '../utils/fetch/billing';
import type { CheckoutNudge } from '../types/billing';

const DISMISSED_KEY = 'checkout-nudge-dismissed';
const HIDDEN_ON = ['/pricing', '/gift/', '/login', '/settings'];

// Every page mounts its own Navbar, so the answer is shared per user.
let cached: { userId: string; request: Promise<CheckoutNudge> } | null = null;

function loadNudge(userId: string) {
  if (cached?.userId !== userId) {
    const request = fetchCheckoutNudge();
    request.catch(() => {
      if (cached?.request === request) cached = null;
    });
    cached = { userId, request };
  }
  return cached.request;
}

function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

export function useCheckoutNudge(user: { userId?: string } | null) {
  const { pathname } = useLocation();
  const [nudge, setNudge] = useState<CheckoutNudge | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const userId = user?.userId;

  useEffect(() => {
    if (!userId) {
      setNudge(null);
      return;
    }
    let cancelled = false;
    loadNudge(userId)
      .then((data) => !cancelled && setNudge(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const startedAt = nudge?.startedAt ?? null;

  const dismiss = useCallback(() => {
    if (!startedAt) return;
    setDismissed(startedAt);
    try {
      localStorage.setItem(DISMISSED_KEY, startedAt);
    } catch {
      // Without storage it comes back on the next visit.
    }
  }, [startedAt]);

  if (
    !nudge ||
    !startedAt ||
    dismissed === startedAt ||
    HIDDEN_ON.some((path) => pathname.startsWith(path))
  ) {
    return null;
  }
  return { price: formatPrice(nudge.monthlyPrice, nudge.currency), dismiss };
}
