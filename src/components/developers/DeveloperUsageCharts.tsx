import { useCallback, useMemo } from 'react';
import { AdminAreaChart, AdminBarChart } from '../admin/AdminChart';
import { ADMIN_CHART_COLORS } from '../admin/adminConstants';

const AREA_HEIGHT = 300;
const BAR_ROW_HEIGHT = 28;

type DailyRow = { date: string; count: number };

export function DeveloperRequestsAreaChart({
  data,
  height = AREA_HEIGHT,
}: {
  data: DailyRow[];
  height?: number;
}) {
  const points = useMemo(
    () => data.map((d) => ({ label: d.date, value: d.count })),
    [data]
  );

  return (
    <AdminAreaChart
      data={points}
      valueLabel="Requests"
      color={ADMIN_CHART_COLORS.blue}
      height={height}
      emptyLabel="No usage data for this period yet"
    />
  );
}

type BreakdownRow = { id: string; count: number };

export function DeveloperBreakdownDonutChart({
  rows,
  labelMap,
  ariaLabel = 'Breakdown',
  color = ADMIN_CHART_COLORS.blue,
}: {
  rows: BreakdownRow[];
  labelMap: Map<string, string>;
  ariaLabel?: string;
  color?: string;
}) {
  const bars = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.count - a.count)
        .map((r) => ({ label: labelMap.get(r.id) ?? r.id, value: r.count })),
    [rows, labelMap]
  );

  const total = useMemo(() => bars.reduce((s, d) => s + d.value, 0), [bars]);

  const formatValue = useCallback(
    (v: number) => {
      const pct = total > 0 ? Math.round((v / total) * 1000) / 10 : 0;
      return `${v.toLocaleString()} (${pct}%)`;
    },
    [total]
  );

  return (
    <div role="group" aria-label={ariaLabel}>
      <AdminBarChart
        data={bars}
        valueLabel="Requests"
        color={color}
        height={Math.max(180, bars.length * BAR_ROW_HEIGHT + 48)}
        emptyLabel="No usage in this period yet"
        formatValue={formatValue}
      />
    </div>
  );
}
