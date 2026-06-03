import { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_TOOLTIP_PANEL =
  'rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 shadow-2xl shadow-black/50';

const SCOPE_COLORS = [
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#a78bfa',
  '#fb7185',
  '#2dd4bf',
  '#94a3b8',
];

type UsageTooltipContentProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: number | string;
    payload?: { date?: string; requests?: number };
  }>;
};

function shortAxisDate(iso: string): string {
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return iso;
  if (iso.includes('T')) {
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fullTooltipDate(iso: string): string {
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return iso;
  if (iso.includes('T')) {
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type DailyRow = { date: string; count: number };

export function DeveloperRequestsAreaChart({ data }: { data: DailyRow[] }) {
  const gid = useId().replace(/:/g, '');
  const gradientId = `reqFill-${gid}`;

  const points = useMemo(
    () =>
      data.map((d) => ({
        date: d.date,
        label: shortAxisDate(d.date),
        requests: d.count,
      })),
    [data]
  );

  const maxRequests = useMemo(
    () => points.reduce((m, p) => Math.max(m, p.requests), 0),
    [points]
  );

  const yAxisMax = maxRequests === 0 ? 8 : Math.ceil(maxRequests * 1.12);

  if (points.length === 0) {
    return (
      <div className="h-full min-h-[200px] flex items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 shadow-inner ring-1 ring-zinc-800/40">
        <p className="text-sm text-zinc-500">
          No usage data for this period yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full min-h-[220px] [&_.recharts-surface]:outline-none"
      role="img"
      aria-label="Request volume over time"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.45} />
              <stop offset="55%" stopColor="#3b82f6" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 6"
            vertical={false}
            stroke="#27272a"
            strokeOpacity={0.85}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: '#3f3f46' }}
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            dy={6}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            width={40}
            allowDecimals={false}
            domain={[0, yAxisMax]}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(96, 165, 250, 0.35)', strokeWidth: 1 }}
            wrapperStyle={{ zIndex: 20 }}
            content={({ active, payload }: UsageTooltipContentProps) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as {
                date: string;
                requests: number;
              };
              return (
                <div className={CHART_TOOLTIP_PANEL}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 mb-0.5">
                    {fullTooltipDate(row.date)}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-zinc-50">
                    {row.requests.toLocaleString()}{' '}
                    <span className="text-zinc-500 font-normal">requests</span>
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="requests"
            stroke="#7dd3fc"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            activeDot={{
              r: 6,
              strokeWidth: 0,
              fill: '#bae6fd',
              className: 'drop-shadow-[0_0_8px_rgba(125,211,252,0.65)]',
            }}
            dot={false}
            isAnimationActive={points.length <= 96}
            animationDuration={700}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type ScopeRow = { scope_id: string; count: number };

export function DeveloperScopeDonutChart({
  rows,
  scopeLabelMap,
}: {
  rows: ScopeRow[];
  scopeLabelMap: Map<string, string>;
}) {
  const pieData = useMemo(
    () =>
      rows.map((r) => ({
        name: scopeLabelMap.get(r.scope_id) ?? r.scope_id,
        value: r.count,
      })),
    [rows, scopeLabelMap]
  );

  const total = useMemo(
    () => pieData.reduce((s, d) => s + d.value, 0),
    [pieData]
  );

  return (
    <div className="flex h-full w-full min-h-[220px] min-w-0 flex-row [&_.recharts-surface]:outline-none">
      {/* Pie centered in the left two-thirds */}
      <div className="flex w-2/3 min-w-0 shrink-0 flex-col items-center justify-center pr-1 sm:pr-2">
        <div className="relative h-full w-full max-w-[min(100%,288px)]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="90%"
                paddingAngle={2.2}
                cornerRadius={6}
                stroke="#09090b"
                strokeWidth={2}
                isAnimationActive
                animationDuration={800}
                animationEasing="ease-out"
              >
                {pieData.map((_, i) => (
                  <Cell
                    key={`cell-${i}`}
                    fill={SCOPE_COLORS[i % SCOPE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                wrapperStyle={{ zIndex: 20 }}
                content={({ active, payload }: UsageTooltipContentProps) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0];
                  const v = Number(p.value);
                  const pct =
                    total > 0 ? Math.round((v / total) * 1000) / 10 : 0;
                  return (
                    <div className={`${CHART_TOOLTIP_PANEL} max-w-[240px]`}>
                      <p className="text-xs font-medium text-zinc-100 leading-snug">
                        {String(p.name)}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-1 tabular-nums">
                        {v.toLocaleString()} call{v === 1 ? '' : 's'} · {pct}%
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Total
              </p>
              <p className="text-lg font-bold tabular-nums text-zinc-100 tracking-tight">
                {total.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Legend along the inner-left edge of the right one-third */}
      <div className="flex w-1/3 min-w-0 shrink-0 flex-col justify-center pl-2 sm:pl-3">
        <ul
          className="flex w-full min-w-0 flex-col justify-center gap-y-2 overflow-y-auto py-1 text-left"
          aria-label="Scope breakdown"
        >
          {pieData.map((d, i) => {
            const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
            return (
              <li
                key={`${d.name}-${i}`}
                className="flex min-w-0 items-start gap-2 text-[11px] text-zinc-400"
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full ring-1 ring-black/20"
                  style={{
                    backgroundColor: SCOPE_COLORS[i % SCOPE_COLORS.length],
                  }}
                />
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="block truncate text-zinc-300">{d.name}</span>
                  <span className="tabular-nums text-zinc-500">{pct}%</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
