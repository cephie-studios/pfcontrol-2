import { useAuth } from '../hooks/auth/useAuth';
import { Navigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { getTesterSettings } from '../utils/fetch/data';
import { useEffectivePlan } from '../hooks/billing/usePlan';
import AccessDenied from './AccessDenied';

type Plan = 'free' | 'basic' | 'ultimate';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireTester?: boolean;
  requireAuth?: boolean;
  requirePermission?: string;
  accessDeniedMessage?: string;
  requiredPlan?: Plan;
  UpgradeFallback?: React.ComponentType<{ currentPlan: Plan; requiredPlan: Plan }>;
}

const PLAN_ORDER: Plan[] = ['free', 'basic', 'ultimate'];

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireTester = true,
  requireAuth = true,
  requirePermission,
  requiredPlan,
  UpgradeFallback,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const { effectivePlan, loading: planLoading } = useEffectivePlan();
  const [testerGateEnabled, setTesterGateEnabled] = useState<boolean | null>(
    null
  );

  const shouldBypassTesterGate = () => {
    return window.location.hostname === 'pfcontrol.com';
  };

  useEffect(() => {
    if (!requireTester || (user && user.isAdmin)) {
      setTesterGateEnabled(false);
      return;
    }

    const checkGateStatus = async () => {
      try {
        if (shouldBypassTesterGate()) {
          setTesterGateEnabled(false);
          return;
        }

        const settings = await getTesterSettings();

        if (settings) {
          setTesterGateEnabled(settings.tester_gate_enabled);
        } else {
          console.error(
            'Failed to fetch tester settings or invalid response:',
            settings
          );
          setTesterGateEnabled(true);
        }
      } catch (error) {
        console.error('Error fetching tester settings:', error);
        setTesterGateEnabled(true);
      }
    };

    checkGateStatus().then();
  }, [requireTester, user]);

  if (isLoading || (requireTester && testerGateEnabled === null) || (requiredPlan && planLoading)) {
    return null;
  }

  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }
  if (user && user.isBanned) {
    return <AccessDenied errorType="banned" />;
  }
  if (requireAdmin && user && !user.isAdmin) {
    return <AccessDenied message="Administrator Access Required" />;
  }

  if (requirePermission && user && !user.isAdmin) {
    const hasPermission =
      user.rolePermissions && user.rolePermissions[requirePermission];
    if (!hasPermission) {
      return (
        <AccessDenied
          message="Insufficient Permissions"
          description={`You need '${requirePermission}' permission to access this page.`}
        />
      );
    }
  }

  if (
    requireTester &&
    testerGateEnabled &&
    !shouldBypassTesterGate() &&
    user &&
    !user.isAdmin &&
    !user.isTester
  ) {
    return (
      <AccessDenied
        message="Tester Access Required"
        description="This application is currently in testing. Please contact an administrator if you believe you should have access."
        errorType="tester-required"
      />
    );
  }

  if (
    !requireAuth &&
    requireTester &&
    testerGateEnabled &&
    !shouldBypassTesterGate() &&
    !user
  ) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPlan && PLAN_ORDER.indexOf(effectivePlan) < PLAN_ORDER.indexOf(requiredPlan)) {
    if (UpgradeFallback) {
      return <UpgradeFallback currentPlan={effectivePlan} requiredPlan={requiredPlan} />;
    }
    return (
      <div className="rounded-2xl border border-blue-800 bg-blue-900/20 px-5 py-4 text-sm text-blue-100">
        <p className="font-semibold mb-2">Upgrade required to access this feature</p>
        <p className="mb-3">
          This area is available on the{' '}
          <span className="font-semibold capitalize">{requiredPlan}</span> plan.
        </p>
        <button
          onClick={() => { window.location.href = '/pricing'; }}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          View plans
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
