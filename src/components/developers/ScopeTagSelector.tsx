import { useMemo } from "react";
import {
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
  type LucideIcon,
} from "lucide-react";

export interface ScopeCatalogEntry {
  id: string;
  label: string;
  description: string;
}

const SCOPE_ICONS: Record<string, LucideIcon> = {
  "data.airports": Building2,
  "data.aircrafts": Plane,
  "data.airlines": Globe,
  "data.frequencies": Radio,
  "data.backgrounds": Image,
  "data.airport_runways": ArrowLeftRight,
  "data.airport_sids": TrendingUp,
  "data.airport_stars": TrendingDown,
  "data.find_route": Route,
  "data.airport_status": Activity,
  "sessions.network_pfatc": Network,
  "sessions.network_aatc": Network,
  "sessions.list": List,
  "sessions.create": Plus,
  "sessions.read": Eye,
  "flights.list": Layers,
  "flights.read": Eye,
  "flights.create": PlaneTakeoff,
  "flights.update": PencilLine,
  "ratings.controller_stats": BarChart3,
  "notifications.read": Bell,
  "flight_logs.read": ScrollText,
};

interface ScopeTagSelectorProps {
  catalog: ScopeCatalogEntry[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  readOnly?: boolean;
  className?: string;
  appearance?: "dark" | "light";
}

export default function ScopeTagSelector({
  catalog,
  selected,
  onChange,
  readOnly = false,
  className = "",
  appearance = "dark",
}: ScopeTagSelectorProps) {
  const light = appearance === "light";
  const groups = useMemo(() => {
    const m = new Map<string, ScopeCatalogEntry[]>();
    for (const c of catalog) {
      const g = c.id.split(".")[0] ?? "other";
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
      <p className={`text-sm py-2 ${light ? "text-slate-500" : "text-zinc-500"}`}>
        No scopes available.
      </p>
    );
  }

  const groupLabelClass = light
    ? "text-[10px] font-semibold uppercase tracking-widest text-sky-800/55 mb-2"
    : "text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2";

  return (
    <div className={`space-y-4 ${className}`}>
      {groups.map(([group, entries]) => (
        <div key={group}>
          <p className={groupLabelClass}>{group}</p>
          <div className="flex flex-wrap gap-2">
            {entries.map((c) => {
              const active = selected.has(c.id);
              const Icon = SCOPE_ICONS[c.id];
              const chipClass = light
                ? [
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 border",
                    readOnly ? "cursor-default" : "cursor-pointer",
                    active
                      ? "bg-sky-600 text-white border-sky-500 shadow-sm shadow-sky-900/10"
                      : readOnly
                        ? "bg-slate-100/80 text-slate-500 border-slate-200"
                        : "bg-white/90 text-slate-700 border-slate-200 hover:border-sky-300 hover:bg-white",
                  ].join(" ")
                : [
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 border",
                    readOnly ? "cursor-default" : "cursor-pointer",
                    active
                      ? "bg-zinc-700 text-zinc-50 border-zinc-600"
                      : readOnly
                        ? "bg-transparent text-zinc-600 border-zinc-800"
                        : "bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200",
                  ].join(" ");
              const iconClass = light
                ? active
                  ? "text-white"
                  : "text-slate-500"
                : active
                  ? "text-zinc-300"
                  : "text-zinc-600";
              return (
                <button
                  key={c.id}
                  type="button"
                  title={c.description}
                  onClick={() => toggle(c.id)}
                  disabled={readOnly}
                  className={chipClass}
                >
                  {Icon && <Icon className={`w-3 h-3 shrink-0 ${iconClass}`} />}
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}