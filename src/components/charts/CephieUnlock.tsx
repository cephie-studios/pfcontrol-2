import { Lock } from 'lucide-react';
import { useAuth } from '../../hooks/auth/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function useCephieLocked() {
  const { user, isLoading } = useAuth();
  return !isLoading && (!user?.plan || user.plan === 'free');
}

export function CephieUnlockStrip({
  count,
  airport,
  className,
}: {
  count?: number;
  airport?: string | null;
  className?: string;
}) {
  const label =
    count && airport
      ? `${count} full-size Cephie ${count === 1 ? 'chart' : 'charts'} for ${airport}`
      : 'Full-size Cephie Charts for every airport';
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border-2 border-zinc-800 bg-zinc-900 px-4 py-3',
        className
      )}
    >
      <Lock className="size-4 shrink-0 text-amber-500" />
      <p className="min-w-0 flex-1 text-sm text-zinc-300">
        <span className="font-medium text-white">{label}</span>. Previews are
        free, Supporter unlocks the real thing.
      </p>
      <Button size="sm" asChild>
        <a href="/pricing">Unlock with Supporter</a>
      </Button>
    </div>
  );
}
