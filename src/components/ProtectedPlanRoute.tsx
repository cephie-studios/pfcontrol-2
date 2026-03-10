import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useAuth } from '../hooks/auth/useAuth';
import { usePlan } from '../hooks/billing/usePlan';

type Plan = 'free' | 'basic' | 'ultimate';

type ProtectedPlanRouteProps = {
  requiredPlan: Plan;
  redirectToLogin?: boolean;
  children: ReactNode;
  UpgradeFallback?: React.ComponentType<{
    currentPlan: Plan;
    requiredPlan: Plan;
  }>;
};

export default function ProtectedPlanRoute({
  requiredPlan,
  redirectToLogin = true,
  children,
  UpgradeFallback,
}: ProtectedPlanRouteProps) {
  const { user, isLoading } = useAuth();
  const {
    plan,
    isBasicOrAbove,
    isUltimate,
    loading: planLoading,
  } = usePlan();

  const hasRequiredPlan = useMemo(() => {
    if (requiredPlan === 'free') return true;
    if (requiredPlan === 'basic') return isBasicOrAbove;
    if (requiredPlan === 'ultimate') return isUltimate;
    return false;
  }, [requiredPlan, isBasicOrAbove, isUltimate]);

  if (isLoading || planLoading) {
    return null;
  }

  if (!user) {
    if (redirectToLogin) {
      const callback = window.location.pathname + window.location.search;
      window.location.href = `/login?callback=${encodeURIComponent(callback)}`;
      return null;
    }
    if (UpgradeFallback) {
      return <UpgradeFallback currentPlan="free" requiredPlan={requiredPlan} />;
    }
    return null;
  }

  if (!hasRequiredPlan) {
    if (UpgradeFallback) {
      return <UpgradeFallback currentPlan={plan} requiredPlan={requiredPlan} />;
    }
    return (
      <div className="rounded-2xl border border-blue-800 bg-blue-900/20 px-5 py-4 text-sm text-blue-100">
        <p className="font-semibold mb-2">
          Upgrade required to access this feature
        </p>
        <p className="mb-3">
          This area is available on the{' '}
          <span className="font-semibold capitalize">{requiredPlan}</span> plan.
        </p>
        <button
          onClick={() => {
            const callback =
              window.location.pathname + window.location.search;
            window.location.href = `/pricing?callback=${encodeURIComponent(
              callback
            )}`;
          }}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          View plans
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

