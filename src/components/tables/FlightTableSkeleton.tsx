import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const CELL_WIDTHS = ['w-12', 'w-16', 'w-10', 'w-14', 'w-20', 'w-8'];

export default function FlightTableSkeleton({
  rows = 8,
  columns = 12,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('mt-6 px-4', className)} role="status">
      <div className="mb-2 h-7" />
      <div className="overflow-hidden rounded-lg">
        <div className="flex h-10 items-center gap-4 bg-blue-950 px-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1 bg-blue-900/70" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex h-11 items-center gap-4 border-t border-zinc-800 bg-zinc-900/70 px-4"
          >
            {Array.from({ length: columns }).map((_, c) => (
              <div key={c} className="flex-1">
                <Skeleton
                  className={cn(
                    'h-3.5 max-w-full',
                    CELL_WIDTHS[(r + c) % CELL_WIDTHS.length]
                  )}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
