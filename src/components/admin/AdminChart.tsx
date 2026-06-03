import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOOLTIP_PANEL =
  "rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 shadow-2xl shadow-black/50 text-sm text-zinc-200";

export type AdminChartPoint = {
  label: string;
  value: number;
  [key: string]: string | number;
};

type AdminAreaChartProps = {
  data: AdminChartPoint[];
  dataKey?: string;
  color?: string;
  height?: number;
  emptyLabel?: string;
  valueLabel?: string;
  hideAxes?: boolean;
};

export type AdminChartSeries = {
  key: string;
  label: string;
  color: string;
  strokeDasharray?: string;
};

type AdminMultiSeriesChartProps = {
  data: Array<Record<string, string | number>>;
  series: AdminChartSeries[];
  xKey?: string;
  height?: number;
  emptyLabel?: string;
  hideAxes?: boolean;
  showLegend?: boolean;
  /** Gradient fill under each series (default true). */
  filled?: boolean;
};

function shortDateLabel(raw: string | Date | number): string {
  const s = raw instanceof Date ? raw.toISOString() : String(raw).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }

  if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?Z?$/.test(s)) {
    const ymd = s.slice(0, 10);
    const d = new Date(`${ymd}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }

  if (s.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  if (s.includes(":")) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  return s;
}

function ChartLegend({ series }: { series: AdminChartSeries[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
      {series.map((s) => (
        <span
          key={s.key}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400"
        >
          <span
            className="inline-block w-4 shrink-0 border-t-2"
            style={{
              borderColor: s.color,
              borderStyle: s.strokeDasharray ? "dashed" : "solid",
            }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function AdminAreaChart({
  data,
  dataKey = "value",
  color = "#60a5fa",
  height = 280,
  emptyLabel = "No data for this period",
  valueLabel = "Count",
  hideAxes = true,
}: AdminAreaChartProps) {
  const gid = useId().replace(/:/g, "");
  const gradientId = `adminFill-${gid}`;

  const points = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: d.label ?? String(d[dataKey] ?? ""),
      })),
    [data, dataKey]
  );

  const maxVal = useMemo(
    () => points.reduce((m, p) => Math.max(m, Number(p[dataKey]) || 0), 0),
    [points, dataKey]
  );
  const yMax = maxVal === 0 ? 8 : Math.ceil(maxVal * 1.12);

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-zinc-900/30 text-sm text-zinc-500"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className="w-full [&_.recharts-surface]:outline-none"
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{
            top: 8,
            right: hideAxes ? 4 : 8,
            left: hideAxes ? 4 : 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="55%" stopColor={color} stopOpacity={0.12} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            hide={hideAxes}
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => shortDateLabel(String(v))}
          />
          <YAxis
            hide={hideAxes}
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={hideAxes ? 0 : 36}
            domain={[0, yMax]}
            allowDecimals={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as AdminChartPoint;
              return (
                <div className={TOOLTIP_PANEL}>
                  <p className="text-zinc-400 text-xs mb-1">
                    {shortDateLabel(String(row?.label))}
                  </p>
                  <p className="font-medium text-white">
                    {valueLabel}:{" "}
                    {Number(payload[0]?.value ?? 0).toLocaleString()}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: "#18181b", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdminMultiSeriesAreaChart({
  data,
  series,
  xKey = "label",
  height = 280,
  emptyLabel = "No data for this period",
  hideAxes = true,
  showLegend = false,
  filled = true,
}: AdminMultiSeriesChartProps) {
  const gid = useId().replace(/:/g, "");
  const gradientPrefix = `adminMultiFill-${gid}`;
  const Chart = filled ? AreaChart : LineChart;
  const margin = {
    top: 8,
    right: hideAxes ? 4 : 8,
    left: hideAxes ? 4 : 0,
    bottom: 0,
  };

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-zinc-900/30 text-sm text-zinc-500"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div>
      <div
        className="w-full [&_.recharts-surface]:outline-none"
        style={{ height }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={margin}>
            {filled ? (
              <defs>
                {series.map((s) => (
                  <linearGradient
                    key={s.key}
                    id={`${gradientPrefix}-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.45} />
                    <stop offset="55%" stopColor={s.color} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
            ) : null}
            <XAxis
              dataKey={xKey}
              hide={hideAxes}
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => shortDateLabel(String(v))}
            />
            <YAxis
              hide={hideAxes}
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={hideAxes ? 0 : 36}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className={TOOLTIP_PANEL}>
                    <p className="text-zinc-400 text-xs mb-2">
                      {shortDateLabel(String(label))}
                    </p>
                    {payload.map((p) => (
                      <p
                        key={String(p.dataKey)}
                        className="text-sm"
                        style={{ color: p.color }}
                      >
                        {p.name}: {Number(p.value ?? 0).toLocaleString()}
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            {series.map((s) =>
              filled ? (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.strokeDasharray}
                  fill={`url(#${gradientPrefix}-${s.key})`}
                  dot={false}
                  activeDot={{
                    r: 3,
                    fill: s.color,
                    stroke: "#18181b",
                    strokeWidth: 2,
                  }}
                />
              ) : (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.strokeDasharray}
                  dot={false}
                  activeDot={{
                    r: 3,
                    strokeWidth: 2,
                    stroke: "#18181b",
                  }}
                />
              )
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
      {showLegend ? <ChartLegend series={series} /> : null}
    </div>
  );
}

export function AdminSparkline({
  data,
  color = "#60a5fa",
  height = 48,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const points = data.map((value, i) => ({ i, value }));
  if (points.length === 0) return null;

  return (
    <div
      className="w-full [&_.recharts-surface]:outline-none"
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
        >
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={color}
            fillOpacity={0.15}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}