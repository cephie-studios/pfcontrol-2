import { useMemo } from "react";

export type PillTab<T extends string | number> = {
  id: T;
  label: string;
};

type Props<T extends string | number> = {
  tabs: PillTab<T>[];
  value: T;
  onChange: (id: T) => void;
  "aria-label": string;
  className?: string;
};

export default function DeveloperPillSegmentedControl<T extends string | number>({
  tabs,
  value,
  onChange,
  "aria-label": ariaLabel,
  className = "",
}: Props<T>) {
  const activeIndex = useMemo(() => {
    const i = tabs.findIndex((t) => t.id === value);
    return i >= 0 ? i : 0;
  }, [tabs, value]);

  const tabCount = tabs.length;

  const btnClass = (active: boolean) =>
    `relative z-10 flex flex-1 min-w-0 items-center justify-center rounded-full px-2 py-2 text-xs font-semibold transition-colors sm:px-3 ${
      active ? "text-white" : "text-zinc-400 hover:text-zinc-200"
    }`;

  return (
    <div
      className={`relative flex rounded-full bg-zinc-800/95 p-1 shadow-inner ring-1 ring-zinc-700/60 ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div
        className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-linear-to-b from-blue-500 to-blue-700 shadow-md transition-[left,width] duration-300 ease-out"
        style={{
          width: tabCount > 0 ? `calc((100% - 0.5rem) / ${tabCount})` : undefined,
          left:
            tabCount > 0
              ? `calc(0.25rem + ${activeIndex} * ((100% - 0.5rem) / ${tabCount}))`
              : undefined,
        }}
        aria-hidden
      />
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={String(t.id)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={btnClass(active)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}