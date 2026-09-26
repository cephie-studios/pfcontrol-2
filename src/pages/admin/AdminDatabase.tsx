import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Database } from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminSection from '../../components/admin/AdminSection';
import AdminStatStrip from '../../components/admin/AdminStatStrip';
import AdminTable from '../../components/admin/AdminTable';
import {
  AdminBarChart,
  AdminMultiSeriesAreaChart,
  type AdminChartSeries,
} from '../../components/admin/AdminChart';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { ADMIN_CHART_COLORS } from '../../components/admin/adminConstants';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  fetchAdminDatabaseStats,
  type AdminDatabaseGrowthDriver,
  type AdminDatabaseStatsResponse,
} from '../../utils/fetch/admin';

const CHART_HEIGHT = 224;
const formatMb = (v: number) => `${v.toLocaleString()} MB`;
const toMb = (bytes: number) => Math.round((bytes / 1024 ** 2) * 10) / 10;

function formatBytes(bytes: number): string {
  const abs = Math.abs(bytes);
  const sign = bytes < 0 ? '-' : '';
  if (abs < 1024) return `${sign}${Math.round(abs)} B`;
  if (abs < 1024 ** 2) return `${sign}${(abs / 1024).toFixed(1)} KB`;
  if (abs < 1024 ** 3) return `${sign}${(abs / 1024 ** 2).toFixed(1)} MB`;
  return `${sign}${(abs / 1024 ** 3).toFixed(2)} GB`;
}

const formatDelta = (bytes: number) =>
  `${bytes >= 0 ? '+' : ''}${formatBytes(bytes)}`;

const formatPct = (pct: number | null) =>
  pct === null ? '—' : `${pct >= 0 ? '+' : ''}${pct}%`;

const PROJECTION_SERIES: AdminChartSeries[] = [
  { key: 'forecast', label: 'Forecast', color: ADMIN_CHART_COLORS.green },
  {
    key: 'high',
    label: 'High',
    color: ADMIN_CHART_COLORS.slate,
    strokeDasharray: '4 4',
  },
  {
    key: 'low',
    label: 'Low',
    color: ADMIN_CHART_COLORS.slate,
    strokeDasharray: '4 4',
  },
  {
    key: 'linear',
    label: 'Measured trend',
    color: ADMIN_CHART_COLORS.amber,
    strokeDasharray: '2 4',
  },
];

const DRIVER_SERIES: AdminChartSeries[] = [
  { key: 'actual', label: 'Actual', color: ADMIN_CHART_COLORS.blue },
  {
    key: 'forecast',
    label: 'Forecast',
    color: ADMIN_CHART_COLORS.green,
    strokeDasharray: '6 4',
  },
  {
    key: 'high',
    label: 'High',
    color: ADMIN_CHART_COLORS.slate,
    strokeDasharray: '2 4',
  },
  {
    key: 'low',
    label: 'Low',
    color: ADMIN_CHART_COLORS.slate,
    strokeDasharray: '2 4',
  },
];

function driverChartData(driver: AdminDatabaseGrowthDriver) {
  const rows: Array<Record<string, string | number>> = driver.history.map(
    (h) => ({
      label: h.date,
      actual: h.value,
    })
  );
  // Start the forecast lines at the last actual value so they connect.
  const lastActual = driver.history[driver.history.length - 1];
  if (rows.length > 0 && lastActual) {
    Object.assign(rows[rows.length - 1], {
      forecast: lastActual.value,
      low: lastActual.value,
      high: lastActual.value,
    });
  }
  for (const f of driver.forecast) {
    rows.push({ label: f.date, forecast: f.value, low: f.low, high: f.high });
  }
  return rows;
}

export default function AdminDatabase() {
  const [data, setData] = useState<AdminDatabaseStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverKey, setDriverKey] =
    useState<AdminDatabaseGrowthDriver['key']>('flights');

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await fetchAdminDatabaseStats());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load database stats'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const topTables = useMemo(
    () =>
      (data?.tables ?? []).slice(0, 12).map((t) => ({
        label: t.name,
        value: Math.round((t.bytes / 1024 ** 2) * 10) / 10,
      })),
    [data]
  );

  const activityRows = useMemo(() => {
    const rows = data?.activitySummary?.tables ?? [];
    return rows
      .filter(
        (t) =>
          t.today.inserted +
            t.today.deleted +
            t.yesterday.inserted +
            t.yesterday.deleted >
          0
      )
      .sort(
        (a, b) =>
          b.today.inserted +
          b.yesterday.inserted -
          (a.today.inserted + a.yesterday.inserted)
      );
  }, [data]);

  const recentStats = useMemo(
    () => (data?.dailyStatistics ?? []).slice(-7),
    [data]
  );

  const projectionChart = useMemo(
    () =>
      (data?.projection ?? []).map((p) => {
        const row: Record<string, string | number> = {
          label: p.date,
          forecast: toMb(p.projectedBytes),
          low: toMb(p.lowBytes),
          high: toMb(p.highBytes),
        };
        if (p.linearBytes !== null) row.linear = toMb(p.linearBytes);
        return row;
      }),
    [data]
  );

  const projectionSeries = useMemo(
    () =>
      data?.projection.some((p) => p.linearBytes !== null)
        ? PROJECTION_SERIES
        : PROJECTION_SERIES.filter((s) => s.key !== 'linear'),
    [data]
  );

  const drivers = data?.growthDrivers ?? [];
  const activeDriver = drivers.find((d) => d.key === driverKey) ?? drivers[0];
  const activeDriverChart = useMemo(
    () => (activeDriver ? driverChartData(activeDriver) : []),
    [activeDriver]
  );

  const growingTables = useMemo(
    () =>
      (data?.tableForecasts ?? [])
        .filter((t) => t.deltaBytes !== 0 || t.insertsPerDay > 0)
        .slice(0, 10),
    [data]
  );

  const growthPercent = data?.growthPercent30d ?? 0;
  const week = data?.projection[7];

  const todayLabel = data?.activitySummary?.today ?? 'Today';
  const yesterdayLabel = data?.activitySummary?.yesterday ?? 'Yesterday';

  return (
    <AdminLayout>
      <AdminPage
        title="Database Monitor"
        icon={Database}
        actions={
          <AdminRefreshButton onClick={() => void load()} loading={loading} />
        }
      >
        {loading && !data ? (
          <AdminLoading label="Loading database stats…" />
        ) : error ? (
          <AdminErrorState
            title="Failed to load"
            message={error}
            onRetry={() => void load()}
          />
        ) : data ? (
          <>
            <AdminStatStrip
              items={[
                { label: 'Total size', value: data.totalFormatted },
                {
                  label: 'In 7 days',
                  value: week ? formatBytes(week.projectedBytes) : '—',
                  sub: week
                    ? `${formatDelta(week.projectedBytes - data.totalBytes)} this week`
                    : undefined,
                },
                {
                  label: 'In 30 days',
                  value: data.projected30dFormatted,
                  sub: `${formatPct(growthPercent)} · range ${formatBytes(
                    data.projected30dLowBytes
                  )}–${formatBytes(data.projected30dHighBytes)}`,
                },
                {
                  label: 'Avg. growth / day',
                  value: formatDelta(data.dailyNetGrowthBytes),
                  sub:
                    data.measuredDailyNetBytes !== null
                      ? `measured: ${formatDelta(data.measuredDailyNetBytes)}/day`
                      : undefined,
                },
              ]}
              columns={4}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <AdminSection title="Table sizes (top 12)">
                <AdminBarChart
                  data={topTables}
                  color={ADMIN_CHART_COLORS.blue}
                  height={CHART_HEIGHT}
                  valueLabel="Size"
                  formatValue={formatMb}
                />
              </AdminSection>

              <AdminSection title="Projected size (30 days)">
                <AdminMultiSeriesAreaChart
                  data={projectionChart}
                  series={projectionSeries}
                  height={CHART_HEIGHT}
                  formatValue={formatMb}
                  beginAtZero={false}
                  filled={false}
                  showLegend
                />
                {data.projectionMethodology && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {data.projectionMethodology}
                  </p>
                )}
              </AdminSection>
            </div>

            {activeDriver ? (
              <AdminSection
                title="Growth drivers"
                description="Last 30 days vs the 30 before, and what the trend and weekday pattern point to next."
                actions={
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={activeDriver.key}
                    onValueChange={(v) => {
                      if (v)
                        setDriverKey(v as AdminDatabaseGrowthDriver['key']);
                    }}
                    aria-label="Growth driver"
                  >
                    {drivers.map((d) => (
                      <ToggleGroupItem key={d.key} value={d.key}>
                        {d.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                }
              >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
                  <AdminMultiSeriesAreaChart
                    data={activeDriverChart}
                    series={DRIVER_SERIES}
                    height={CHART_HEIGHT}
                    filled={false}
                    showLegend
                  />
                  <AdminStatStrip
                    columns={2}
                    items={[
                      {
                        label: 'Last 30 days',
                        value: activeDriver.last30.toLocaleString(),
                        sub: `${formatPct(activeDriver.change30Pct)} vs prior 30d`,
                      },
                      {
                        label: 'Trend',
                        value: `${formatPct(activeDriver.weeklyGrowthPct)}/wk`,
                        sub: activeDriver.peakWeekday
                          ? `peaks ${activeDriver.peakWeekday} (${activeDriver.peakFactor}×)`
                          : 'no weekday pattern',
                      },
                      {
                        label: 'Next 7 days',
                        value: `~${activeDriver.next7.toLocaleString()}`,
                        sub: `last 7: ${activeDriver.last7.toLocaleString()}`,
                      },
                      {
                        label: 'Next 30 days',
                        value: `~${activeDriver.next30.toLocaleString()}`,
                        sub:
                          activeDriver.total !== null
                            ? `→ ~${(
                                activeDriver.total + activeDriver.next30
                              ).toLocaleString()} total users`
                            : `${activeDriver.next30Low.toLocaleString()}–${activeDriver.next30High.toLocaleString()}`,
                      },
                    ]}
                  />
                </div>
              </AdminSection>
            ) : null}

            {growingTables.length > 0 ? (
              <AdminSection
                title="Forecast by table (30 days)"
                description="Tables with retention stay flat once deletes keep up with inserts; the rest grow with activity."
              >
                <AdminTable minWidth="720px">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Table</TableHead>
                      <TableHead className="text-right">Now</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                      <TableHead className="text-right">Inserts/day</TableHead>
                      <TableHead className="text-right">Deletes/day</TableHead>
                      <TableHead className="text-right">Trend</TableHead>
                      <TableHead className="px-4 text-right">
                        Retention
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {growingTables.map((t) => (
                      <TableRow key={t.table}>
                        <TableCell className="px-4 font-mono text-xs">
                          {t.table}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBytes(t.currentBytes)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDelta(t.deltaBytes)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {t.insertsPerDay.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {t.deletesPerDay.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPct(t.weeklyGrowthPct)}/wk
                        </TableCell>
                        <TableCell className="px-4 text-right tabular-nums text-muted-foreground">
                          {t.retentionDays ? `${t.retentionDays}d` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </AdminTable>
              </AdminSection>
            ) : null}

            <AdminSection
              title={`Table activity (${yesterdayLabel} vs ${todayLabel})`}
            >
              {activityRows.length === 0 ? (
                <AdminEmptyState icon={Activity} title="No activity yet" />
              ) : (
                <AdminTable minWidth="640px">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Table</TableHead>
                      <TableHead className="text-right">
                        Inserted ({yesterdayLabel})
                      </TableHead>
                      <TableHead className="text-right">
                        Deleted ({yesterdayLabel})
                      </TableHead>
                      <TableHead className="text-right">
                        Inserted ({todayLabel})
                      </TableHead>
                      <TableHead className="px-4 text-right">
                        Deleted ({todayLabel})
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityRows.map((row) => (
                      <TableRow key={row.table}>
                        <TableCell className="px-4 font-mono text-xs">
                          {row.table}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.yesterday.inserted.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.yesterday.deleted.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.today.inserted.toLocaleString()}
                        </TableCell>
                        <TableCell className="px-4 text-right tabular-nums">
                          {row.today.deleted.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </AdminTable>
              )}
            </AdminSection>

            {recentStats.length > 0 ? (
              <AdminSection title="Platform activity (last 7 days)">
                <AdminTable minWidth="560px">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Date</TableHead>
                      <TableHead className="text-right">Logins</TableHead>
                      <TableHead className="text-right">New users</TableHead>
                      <TableHead className="text-right">New sessions</TableHead>
                      <TableHead className="px-4 text-right">
                        New flights
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentStats.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell className="px-4 tabular-nums">
                          {row.date}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.logins.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.newUsers.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.newSessions.toLocaleString()}
                        </TableCell>
                        <TableCell className="px-4 text-right tabular-nums">
                          {row.newFlights.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </AdminTable>
              </AdminSection>
            ) : null}

            <AdminSection title="Retention policies">
              <AdminTable minWidth="480px">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Table</TableHead>
                    <TableHead>Retention</TableHead>
                    <TableHead className="px-4">Label</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.retentionPolicies.map((p) => (
                    <TableRow key={p.table}>
                      <TableCell className="px-4 font-mono text-xs">
                        {p.table}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {p.retentionDays} days
                      </TableCell>
                      <TableCell className="px-4 text-muted-foreground">
                        {p.label}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </AdminTable>
            </AdminSection>
          </>
        ) : null}
      </AdminPage>
    </AdminLayout>
  );
}
