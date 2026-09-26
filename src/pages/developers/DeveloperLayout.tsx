import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Outlet, useSearchParams } from 'react-router';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Loader2,
  RefreshCw,
  X,
  type LucideIcon,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import DeveloperSubnav from './DeveloperSubnav';
import { API_EXT_BASE } from './constants';
import {
  DeveloperPortalProvider,
  useDeveloperPortal,
} from './developerPortalContext';

function DeveloperBanner({
  icon: Icon,
  iconClassName,
  onDismiss,
  role,
  children,
}: {
  icon: LucideIcon;
  iconClassName: string;
  onDismiss: () => void;
  role?: 'alert' | 'status';
  children: ReactNode;
}) {
  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-2xl border bg-card px-4 py-3 text-sm"
      role={role}
    >
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', iconClassName)}
        aria-hidden
      />
      <span className="min-w-0 flex-1 leading-relaxed">{children}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="-my-0.5 text-muted-foreground"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        <X />
      </Button>
    </div>
  );
}

function DeveloperShell() {
  const { error, setError, loading, dashLoading, refresh, loadApplication } =
    useDeveloperPortal();
  const [refreshSpinOnce, setRefreshSpinOnce] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [notifyEmailBanner, setNotifyEmailBanner] = useState<
    'removed' | 'invalid' | 'stale' | null
  >(null);

  useEffect(() => {
    const v = searchParams.get('notifyEmailRemoved');
    if (v === null) return;
    const next = new URLSearchParams(searchParams);
    next.delete('notifyEmailRemoved');
    setSearchParams(next, { replace: true });
    if (v === '1') {
      setNotifyEmailBanner('removed');
      void loadApplication();
    } else if (v === 'stale') {
      setNotifyEmailBanner('stale');
    } else {
      setNotifyEmailBanner('invalid');
    }
  }, [searchParams, setSearchParams, loadApplication]);

  const handleRefresh = () => {
    setRefreshSpinOnce(true);
    refresh();
  };

  return (
    <TooltipProvider>
      <div className="shadcn-scope flex h-dvh flex-col bg-background text-foreground">
        <Navbar />
        <div
          data-scroll-root="true"
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-scroll [scrollbar-gutter:stable]"
        >
          <div className="mx-auto max-w-7xl px-4 py-10 pt-24 pb-16 sm:px-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Code2 className="size-4 text-blue-400" />
                  <span>
                    Developers <span className="text-red-400">Beta</span>
                  </span>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Developer API
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Base URL:{' '}
                  <code className="font-mono text-xs break-all text-foreground sm:text-sm">
                    {API_EXT_BASE}
                  </code>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleRefresh}
                className="shrink-0"
              >
                <RefreshCw
                  className={cn(
                    refreshSpinOnce && 'dev-refresh-spin-once',
                    (dashLoading || loading) &&
                      !refreshSpinOnce &&
                      'animate-spin'
                  )}
                  onAnimationEnd={() => setRefreshSpinOnce(false)}
                />
                Refresh
              </Button>
            </div>

            <DeveloperSubnav />

            {notifyEmailBanner === 'removed' && (
              <DeveloperBanner
                icon={CheckCircle2}
                iconClassName="text-emerald-400"
                role="status"
                onDismiss={() => setNotifyEmailBanner(null)}
              >
                Your notification email was removed. You won&apos;t receive
                developer update emails anymore.
              </DeveloperBanner>
            )}
            {notifyEmailBanner === 'stale' && (
              <DeveloperBanner
                icon={AlertTriangle}
                iconClassName="text-amber-400"
                role="status"
                onDismiss={() => setNotifyEmailBanner(null)}
              >
                That unsubscribe link is no longer valid, or your notification
                address was already cleared.
              </DeveloperBanner>
            )}
            {notifyEmailBanner === 'invalid' && (
              <DeveloperBanner
                icon={AlertTriangle}
                iconClassName="text-amber-400"
                role="status"
                onDismiss={() => setNotifyEmailBanner(null)}
              >
                This unsubscribe link is invalid or has expired.
              </DeveloperBanner>
            )}

            {error && (
              <DeveloperBanner
                icon={AlertCircle}
                iconClassName="text-destructive"
                role="alert"
                onDismiss={() => setError(null)}
              >
                {error}
              </DeveloperBanner>
            )}

            <Suspense
              fallback={
                <div className="flex justify-center py-24">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default function DeveloperLayout() {
  return (
    <DeveloperPortalProvider>
      <DeveloperShell />
    </DeveloperPortalProvider>
  );
}
