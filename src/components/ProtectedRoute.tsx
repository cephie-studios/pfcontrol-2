import { useAuth } from '../hooks/auth/useAuth';
import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getTesterSettings } from '../utils/fetch/data';
import AccessDenied from './AccessDenied';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireTester?: boolean;
  requireAuth?: boolean;
  requirePermission?: string;
  accessDeniedMessage?: string;
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireTester = true,
  requireAuth = true,
  requirePermission,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
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

  if (isLoading || (requireTester && testerGateEnabled === null)) {
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

  return <>{children}</>;
}
