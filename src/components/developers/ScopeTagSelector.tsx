import { useMemo } from 'react';
import {
  Check,
  Building2,
  Plane,
  Globe,
  Radio,
  Image,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Route,
  Activity,
  Network,
  List,
  Plus,
  Eye,
  Layers,
  PlaneTakeoff,
  PencilLine,
  BarChart3,
  Bell,
  ScrollText,
  Trash2,
  Radar,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ScopeCatalogEntry {
  id: string;
  label: string;
  description: string;
}

const SCOPE_ICONS: Record<string, LucideIcon> = {
  'data.airports': Building2,
  'data.aircrafts': Plane,
  'data.airlines': Globe,
  'data.frequencies': Radio,
  'data.backgrounds': Image,
  'data.airport_runways': ArrowLeftRight,
  'data.airport_sids': TrendingUp,
  'data.airport_stars': TrendingDown,
  'data.find_route': Route,
  'data.airport_status': Activity,
  'sessions.network_pfatc': Network,
  'sessions.network_overview': Radar,
  // 'sessions.network_aatc': Network, // AATC disabled
  'sessions.list': List,
  'sessions.create': Plus,
  'sessions.read': Eye,
  'flights.list': Layers,
  'flights.read': Eye,
  'flights.create': PlaneTakeoff,
  'flights.update': PencilLine,
  'flights.delete': Trash2,
  'sessions.delete': Trash2,
  'ratings.controller_stats': BarChart3,
  'notifications.read': Bell,
  'flight_logs.read': ScrollText,
};

interface ScopeTagSelectorProps {
  catalog: ScopeCatalogEntry[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  readOnly?: boolean;
  className?: string;
  appearance?: 'dark' | 'light';
}

function groupLabel(group: string) {
  const text = group.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function ScopeTagSelector({
  catalog,
  selected,
  onChange,
  readOnly = false,
  className = '',
}: ScopeTagSelectorProps) {
  const groups = useMemo(() => {
    const m = new Map<string, ScopeCatalogEntry[]>();
    for (const c of catalog) {
      const g = c.id.split('.')[0] ?? 'other';
      const arr = m.get(g) ?? [];
      arr.push(c);
      m.set(g, arr);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  const toggle = (id: string) => {
    if (readOnly) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  if (groups.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">No scopes available.</p>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {groups.map(([group, entries]) => (
        <div key={group} className="grid gap-1.5">
          <p className="px-2 text-xs font-medium text-muted-foreground">
            {groupLabel(group)}
          </p>
          <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {entries.map((c) => {
              const active = selected.has(c.id);
              const Icon = SCOPE_ICONS[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  title={c.description}
                  onClick={() => toggle(c.id)}
                  disabled={readOnly}
                  aria-pressed={active}
                  className={cn(
                    'flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    active ? 'text-foreground' : 'text-muted-foreground',
                    readOnly
                      ? 'cursor-default'
                      : 'cursor-pointer hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input dark:bg-input/30'
                    )}
                    aria-hidden
                  >
                    {active ? <Check className="size-3.5" /> : null}
                  </span>
                  {Icon ? (
                    <Icon
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  ) : null}
                  <span className="truncate">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
