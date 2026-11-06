import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ADMIN_STAT_COLUMNS, ADMIN_TABLE_FRAME } from './adminConstants';

export function AdminLoading({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground',
        className
      )}
      role="status"
    >
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function AdminEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-12 text-center',
        className
      )}
    >
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function AdminErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center',
        className
      )}
      role="alert"
    >
      <AlertCircle className="mb-1 size-6 text-destructive" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

const SKELETON_CELL_WIDTHS = ['w-32', 'w-20', 'w-24', 'w-16', 'w-28', 'w-12'];

export function AdminTableSkeleton({
  columns = 5,
  rows = 8,
  avatar = true,
  className,
}: {
  columns?: number;
  rows?: number;
  avatar?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(ADMIN_TABLE_FRAME, className)}
      role="status"
      aria-label="Loading"
    >
      <div className="flex h-11 items-center gap-6 bg-muted/40 px-4">
        {Array.from({ length: columns }).map((_, c) => (
          <Skeleton
            key={c}
            className={cn('h-3', c === 0 ? 'w-24 flex-[2]' : 'w-16 flex-1')}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex h-14 items-center gap-6 border-t px-4 first:border-t-0"
        >
          {Array.from({ length: columns }).map((_, c) =>
            c === 0 ? (
              <div key={c} className="flex flex-[2] items-center gap-3">
                {avatar && (
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                )}
                <Skeleton
                  className={cn(
                    'h-4',
                    SKELETON_CELL_WIDTHS[r % SKELETON_CELL_WIDTHS.length]
                  )}
                />
              </div>
            ) : (
              <div key={c} className="flex-1">
                <Skeleton
                  className={cn(
                    'h-3.5',
                    SKELETON_CELL_WIDTHS[(r + c) % SKELETON_CELL_WIDTHS.length]
                  )}
                />
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
}

export function AdminCardListSkeleton({
  count = 4,
  lines = 2,
  className,
}: {
  count?: number;
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col gap-3', className)}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
          {Array.from({ length: lines }).map((_, l) => (
            <Skeleton
              key={l}
              className={cn('h-3.5', l === lines - 1 ? 'w-2/3' : 'w-full')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function AdminStatCardsSkeleton({
  count = 4,
  columns = 4,
  className,
}: {
  count?: number;
  columns?: 2 | 3 | 4 | 6;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid overflow-hidden rounded-2xl border',
        ADMIN_STAT_COLUMNS[columns],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="-mt-px -ml-px border-t border-l px-4 py-3">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="mt-2 h-6 w-14" />
        </div>
      ))}
    </div>
  );
}

export function AdminChartSkeleton({
  height = 200,
  title = true,
  className,
}: {
  height?: number;
  title?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn('flex min-w-0 flex-col gap-3', className)}
      role="status"
      aria-label="Loading"
    >
      {title && <Skeleton className="h-5 w-40" />}
      <Skeleton className="w-full rounded-2xl" style={{ height }} />
    </div>
  );
}
