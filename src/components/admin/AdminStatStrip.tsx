import { adminStatStripItemClass } from './adminConstants';

export type AdminStatItem = {
  label: string;
  value: string | number;
  sub?: string;
};

type AdminStatStripProps = {
  items: AdminStatItem[];
  columns?: 2 | 3 | 4;
};

export default function AdminStatStrip({
  items,
  columns = 4,
}: AdminStatStripProps) {
  const colClass =
    columns === 2
      ? 'grid-cols-2'
      : columns === 3
        ? 'grid-cols-2 sm:grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-4';

  return (
    <div
      className={`grid ${colClass} gap-x-6 gap-y-4 mb-5 pb-5 border-b border-zinc-800/80`}
    >
      {items.map((item) => (
        <div key={item.label} className={adminStatStripItemClass()}>
          <p className="text-xs xl:text-sm text-zinc-500 uppercase tracking-wide">
            {item.label}
          </p>
          <p className="text-xl sm:text-2xl xl:text-3xl font-semibold text-white tabular-nums mt-0.5">
            {typeof item.value === 'number'
              ? item.value.toLocaleString()
              : item.value}
          </p>
          {item.sub && (
            <p className="text-xs xl:text-sm text-zinc-500 mt-0.5 truncate">
              {item.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
