import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminTableSkeleton } from '@/components/admin/AdminStates';
import { cn } from '@/lib/utils';

const LABEL_WIDTHS = ['w-28', 'w-36', 'w-24', 'w-32'];
const DESCRIPTION_WIDTHS = ['w-64', 'w-52', 'w-72', 'w-56'];

export function DeveloperRowSkeleton({
  index = 0,
  icon = true,
  trailing,
}: {
  index?: number;
  icon?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        {icon && <Skeleton className="size-8 shrink-0 rounded-full" />}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex h-5 items-center">
            <Skeleton
              className={cn('h-4', LABEL_WIDTHS[index % LABEL_WIDTHS.length])}
            />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton
              className={cn(
                'h-3.5 max-w-full',
                DESCRIPTION_WIDTHS[index % DESCRIPTION_WIDTHS.length]
              )}
            />
          </div>
        </div>
      </div>
      {trailing}
    </div>
  );
}

export function DeveloperGroupSkeleton({
  title = false,
  className,
  children,
}: {
  title?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {title && (
        <div className="flex h-5 items-center px-1">
          <Skeleton className="h-3.5 w-24" />
        </div>
      )}
      <div
        className={cn(
          'flex flex-col divide-y overflow-hidden rounded-2xl border bg-card',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function DeveloperSectionSkeleton({
  rows = 3,
  groupTitle = false,
  actions,
  trailing,
  children,
}: {
  rows?: number;
  groupTitle?: boolean;
  actions?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-5 w-36" />
        </div>
        {actions}
      </div>
      {children ?? (
        <DeveloperGroupSkeleton title={groupTitle}>
          {Array.from({ length: rows }).map((_, i) => (
            <DeveloperRowSkeleton key={i} index={i} trailing={trailing} />
          ))}
        </DeveloperGroupSkeleton>
      )}
    </div>
  );
}

export function DeveloperChartSkeleton({ height }: { height: number }) {
  return <Skeleton className="w-full rounded-xl" style={{ height }} />;
}

export function DeveloperPortalSkeleton() {
  return (
    <div className="flex flex-col gap-10" role="status" aria-label="Loading">
      <DeveloperSectionSkeleton rows={3} />
      <DeveloperSectionSkeleton rows={1} />
    </div>
  );
}

export function DeveloperOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-10" role="status" aria-label="Loading">
      <DeveloperSectionSkeleton
        rows={3}
        trailing={<Skeleton className="size-4 shrink-0" />}
      />
      <DeveloperSectionSkeleton
        rows={1}
        trailing={
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-9 w-20" />
          </div>
        }
      />
    </div>
  );
}

export function DeveloperKeysSkeleton() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-label="Loading">
      <DeveloperSectionSkeleton
        rows={3}
        groupTitle
        actions={<Skeleton className="h-9 w-28" />}
        trailing={<Skeleton className="size-8 shrink-0" />}
      />
    </div>
  );
}

export function DeveloperConsoleSkeleton({
  chartHeight,
}: {
  chartHeight: number;
}) {
  return (
    <div className="flex flex-col gap-10" role="status" aria-label="Loading">
      <DeveloperSectionSkeleton actions={<Skeleton className="h-8 w-44" />}>
        <DeveloperGroupSkeleton>
          <div className="px-5 py-4">
            <DeveloperChartSkeleton height={chartHeight} />
          </div>
          <div className="flex h-[52px] items-center px-5">
            <Skeleton className="h-3.5 w-56" />
          </div>
        </DeveloperGroupSkeleton>
      </DeveloperSectionSkeleton>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-6">
        {[0, 1].map((i) => (
          <DeveloperSectionSkeleton key={i}>
            <DeveloperGroupSkeleton>
              <div className="px-5 py-4">
                <DeveloperChartSkeleton height={180} />
              </div>
            </DeveloperGroupSkeleton>
          </DeveloperSectionSkeleton>
        ))}
      </div>

      <DeveloperSectionSkeleton
        actions={
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-9 w-48" />
          </div>
        }
      >
        <AdminTableSkeleton columns={7} rows={5} avatar={false} />
      </DeveloperSectionSkeleton>
    </div>
  );
}

export function DeveloperDocsSkeleton() {
  return (
    <div
      className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-10 xl:grid-cols-[17rem_minmax(0,1fr)]"
      role="status"
      aria-label="Loading"
    >
      <div className="hidden flex-col gap-4 lg:flex">
        <Skeleton className="h-9 w-full" />
        {[4, 6].map((count, s) => (
          <div key={s} className="flex flex-col gap-1">
            <Skeleton className="mx-2.5 mb-1 h-3 w-20" />
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5">
                <Skeleton className="h-3.5 w-10" />
                <Skeleton
                  className={cn(
                    'h-3.5',
                    LABEL_WIDTHS[(i + s) % LABEL_WIDTHS.length]
                  )}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <DeveloperSectionSkeleton>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
          <DeveloperGroupSkeleton>
            {Array.from({ length: 2 }).map((_, i) => (
              <DeveloperRowSkeleton
                key={i}
                index={i}
                trailing={<Skeleton className="size-8 shrink-0" />}
              />
            ))}
          </DeveloperGroupSkeleton>
        </DeveloperSectionSkeleton>
        <DeveloperSectionSkeleton rows={3} />
      </div>
    </div>
  );
}
