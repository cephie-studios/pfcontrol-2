import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';

type Plan = 'free' | 'basic' | 'ultimate';

interface PlanCapabilities {
  maxSessions: number;
  maxConcurrentSessionUsers: number;
  pfatcOverview: boolean;
  basicAcars: boolean;
  pdcAtis: boolean;
  profileBadge: boolean;
  customBackgrounds: boolean;
  textChat: boolean;
  voiceChat: boolean;
  earlyAccess: boolean;
}

interface PlanResponse {
  plan: Plan;
  isBasicOrAbove: boolean;
  isUltimate: boolean;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  subscriptionCancelAtPeriodEnd: boolean | null;
  limits: {
    maxSessions: number;
  };
  capabilities: PlanCapabilities;
}

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;
const PLAN_STORAGE_KEY_PREFIX = 'pfcontrol_plan_';

function getPlanFromStorage(userId: string): PlanResponse | null {
  try {
    const raw = localStorage.getItem(`${PLAN_STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || typeof (parsed as PlanResponse).plan !== 'string') return null;
    return parsed as PlanResponse;
  } catch {
    return null;
  }
}

function setPlanInStorage(userId: string, data: PlanResponse): void {
  try {
    localStorage.setItem(`${PLAN_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    // ignore quota or disabled localStorage
  }
}

export function usePlan() {
  const { user } = useAuth();
  const userId = user?.userId;
  const [data, setData] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const cached = getPlanFromStorage(userId);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    const syncIfNeeded = async () => {
      try {
        const search = window.location.search;
        const params = new URLSearchParams(search);
        if (params.get('stripe') === 'success') {
          await fetch(`${API_BASE_URL}/api/stripe/sync`, {
            method: 'POST',
            credentials: 'include',
          }).catch(() => undefined);
          params.delete('stripe');
          const newSearch = params.toString();
          const newUrl =
            window.location.pathname + (newSearch ? `?${newSearch}` : '');
          window.history.replaceState(null, '', newUrl);
        }
      } catch {
        // ignore
      }
    };

    const load = async () => {
      if (!cached) setLoading(true);
      try {
        await syncIfNeeded();
        let res = await fetch(`${API_BASE_URL}/api/plan/me`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error('Failed to load plan');
        }
        let json = (await res.json()) as PlanResponse;

        // Cross-check with Stripe for non-free plans to avoid stale state
        if (json.plan !== 'free') {
          try {
            const syncRes = await fetch(`${API_BASE_URL}/api/stripe/sync`, {
              method: 'POST',
              credentials: 'include',
            });
            if (syncRes.ok) {
              const res2 = await fetch(`${API_BASE_URL}/api/plan/me`, {
                credentials: 'include',
              });
              if (res2.ok) {
                json = (await res2.json()) as PlanResponse;
              }
            }
          } catch {
            // If sync fails, fall back to previously loaded json
          }
        }

        if (!cancelled) {
          setData(json);
          setPlanInStorage(userId, json);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading plan:', err);
          setError('Failed to load plan');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    plan: data?.plan ?? 'free',
    isBasicOrAbove: data?.isBasicOrAbove ?? false,
    isUltimate: data?.isUltimate ?? false,
    limits: data?.limits ?? { maxSessions: 3 },
    capabilities:
      data?.capabilities ??
      {
        maxSessions: data?.limits?.maxSessions ?? 3,
        maxConcurrentSessionUsers: 2,
        pfatcOverview: true,
        basicAcars: true,
        pdcAtis: false,
        profileBadge: false,
        customBackgrounds: false,
        textChat: false,
        voiceChat: false,
        earlyAccess: false,
      },
    subscriptionStatus: data?.subscriptionStatus ?? null,
    subscriptionCurrentPeriodEnd: data?.subscriptionCurrentPeriodEnd ?? null,
    subscriptionCancelAtPeriodEnd:
      data?.subscriptionCancelAtPeriodEnd ?? null,
    loading,
    error,
  };
}

const ULTIMATE_CAPABILITIES: PlanCapabilities = {
  maxSessions: 250,
  maxConcurrentSessionUsers: 0,
  pfatcOverview: true,
  basicAcars: true,
  pdcAtis: true,
  profileBadge: true,
  customBackgrounds: true,
  textChat: true,
  voiceChat: true,
  earlyAccess: true,
};

export function useEffectivePlan() {
  const { user } = useAuth();
  const planData = usePlan();

  const isAdmin = !!user?.isAdmin;
  const isTester = !!user?.isTester;

  const effectivePlan: Plan =
    isAdmin || isTester ? 'ultimate' : planData.plan;

  const effectiveCapabilities: PlanCapabilities =
    isAdmin || isTester
      ? { ...planData.capabilities, ...ULTIMATE_CAPABILITIES }
      : planData.capabilities;

  const effectiveLimits = {
    ...planData.limits,
    maxSessions: effectiveCapabilities.maxSessions,
  };

  return {
    ...planData,
    effectivePlan,
    effectiveCapabilities,
    effectiveLimits,
    isAdmin,
    isTester,
  };
}


