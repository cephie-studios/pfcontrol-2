import { adminCardClass } from './adminConstants';
import type { AdminStatItem } from './AdminStatStrip';

type AdminStatCardsProps = {
  items: AdminStatItem[];
  columns?: 2 | 3 | 4;
};

export default function AdminStatCards({
  items,
  columns = 4,
}: AdminStatCardsProps) {
  const colClass =
    columns === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${colClass} gap-3 mb-5`}>
      {items.map((item) => (
        <div key={item.label} className={adminCardClass('!p-4')}>
          <p className="text-xs xl:text-sm text-zinc-500 uppercase tracking-wide">
            {item.label}
          </p>
          <p className="text-xl sm:text-2xl xl:text-3xl font-semibold text-white tabular-nums mt-1">
            {typeof item.value === 'number'
              ? item.value.toLocaleString()
              : item.value}
          </p>
          {item.sub ? (
            <p className="text-xs xl:text-sm text-zinc-500 mt-1 truncate">
              {item.sub}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
