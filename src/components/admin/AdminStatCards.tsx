import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_STAT_COLUMNS } from './adminConstants';

export type AdminStatItem = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
};

type AdminStatCardsProps = {
  items: AdminStatItem[];
  columns?: 2 | 3 | 4 | 6;
  className?: string;
};

export default function AdminStatCards({
  items,
  columns = 4,
  className,
}: AdminStatCardsProps) {
  return (
    <div
      className={cn(
        'grid overflow-hidden rounded-2xl border',
        ADMIN_STAT_COLUMNS[columns],
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="-mt-px -ml-px min-w-0 border-t border-l px-4 py-3"
        >
          <p className="truncate text-sm text-muted-foreground">{item.label}</p>
          <p className="mt-0.5 truncate text-xl font-semibold tabular-nums">
            {typeof item.value === 'number'
              ? item.value.toLocaleString()
              : item.value}
          </p>
          {item.sub ? (
            <p className="truncate text-xs text-muted-foreground">{item.sub}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
