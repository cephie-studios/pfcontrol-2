import { Camera, History, LayoutDashboard, StickyNote } from 'lucide-react';

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'photos', label: 'Photos', icon: Camera },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'timeline', label: 'Timeline', icon: History },
] as const;

export type FlightTab = (typeof TABS)[number]['key'];

interface FlightTabsProps {
  active: FlightTab;
  onChange: (tab: FlightTab) => void;
}

export default function FlightTabs({ active, onChange }: FlightTabsProps) {
  const activeIndex = TABS.findIndex((t) => t.key === active);

  return (
    <nav
      className="relative flex rounded-full bg-zinc-900/95 p-1 shadow-inner ring-1 ring-zinc-700/60"
      aria-label="Flight sections"
    >
      <div
        className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-linear-to-b from-blue-500 to-blue-700 shadow-md transition-[left,width] duration-300 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${TABS.length})`,
          left: `calc(0.25rem + ${activeIndex} * ((100% - 0.5rem) / ${TABS.length}))`,
        }}
        aria-hidden
      />
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-semibold transition-colors sm:gap-2 sm:px-3 ${
              isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0 opacity-90" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.slice(0, 1)}</span>
          </button>
        );
      })}
    </nav>
  );
}
