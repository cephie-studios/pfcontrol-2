import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import AdminRefreshButton from '../components/admin/AdminRefreshButton';
import AdminLayout from '../components/admin/AdminLayout';
import AdminPage from '../components/admin/AdminPage';
import AdminSection from '../components/admin/AdminSection';
import AdminStatCards from '../components/admin/AdminStatCards';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../components/admin/AdminStates';
import {
  AdminAreaChart,
  AdminMultiSeriesAreaChart,
  type AdminChartSeries,
} from '../components/admin/AdminChart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '../hooks/auth/useAuth';
import {
  fetchAdminStatistics,
  fetchAdminStatisticsForecast,
  type AdminDatabaseGrowthDriver,
  fetchAppVersion,
  fetchApiLogStats24h,
  type AdminStats,
  type AppVersion,
} from '../utils/fetch/admin';

type ActivityChartView = 'flights' | 'sessions' | 'accounts';

const TIME_RANGES = [7, 30, 90, 180, 365];

const ACTIVITY_CHART_VIEWS: {
  id: ActivityChartView;
  label: string;
  color: string;
  periodKey: 'total_flights' | 'total_sessions' | null;
  periodLabel?: string;
}[] = [
  {
    id: 'flights',
    label: 'Flights',
    color: '#a78bfa',
    periodKey: 'total_flights',
  },
  {
    id: 'sessions',
    label: 'Sessions',
    color: '#34d399',
    periodKey: 'total_sessions',
  },
  {
    id: 'accounts',
    label: 'Accounts',
    color: '#60a5fa',
    periodKey: null,
  },
];

const ACCOUNTS_SERIES = [
  { key: 'logins', label: 'Logins', color: '#60a5fa', strokeDasharray: '2 3' },
  {
    key: 'users',
    label: 'New users',
    color: '#fbbf24',
    strokeDasharray: '8 4',
  },
] as const;

const API_SERIES = [
  { key: 'successful', label: '2xx', color: '#34d399' },
  {
    key: 'clientErrors',
    label: '4xx',
    color: '#fbbf24',
    strokeDasharray: '6 4',
  },
  {
    key: 'serverErrors',
    label: '5xx',
    color: '#f87171',
    strokeDasharray: '2 3',
  },
  { key: 'other', label: 'Other', color: '#94a3b8', strokeDasharray: '8 4' },
] as const;

const FORECAST_BAND_COLOR = '#94a3b8';

const FORECAST_DRIVER_BY_KEY: Record<string, AdminDatabaseGrowthDriver['key']> =
  {
    flights: 'flights',
    sessions: 'sessions',
    logins: 'logins',
    users: 'users',
  };

type ChartRow = Record<string, string | number>;

function appendForecast(
  rows: ChartRow[],
  keys: string[],
  drivers: AdminDatabaseGrowthDriver[],
  withBand: boolean
): ChartRow[] {
  const out = rows.map((r) => ({ ...r }));
  const byDate = new Map(out.map((r) => [String(r.label).slice(0, 10), r]));

  for (const key of keys) {
    const driver = drivers.find((d) => d.key === FORECAST_DRIVER_BY_KEY[key]);
    const first = driver?.forecast[0];
    if (!driver || !first) continue;

    const anchor = driver.history[driver.history.length - 1];
    const anchorRow = anchor ? byDate.get(anchor.date) : undefined;
    if (anchorRow && anchorRow[key] !== undefined) {
      anchorRow[`${key}Forecast`] = anchorRow[key];
      if (withBand) {
        anchorRow[`${key}Low`] = anchorRow[key];
        anchorRow[`${key}High`] = anchorRow[key];
      }
    }

    for (const point of driver.forecast) {
      let row = byDate.get(point.date);
      if (!row) {
        row = { label: point.date };
        byDate.set(point.date, row);
        out.push(row);
      }
      row[`${key}Forecast`] = point.value;
      if (withBand) {
        row[`${key}Low`] = point.low;
        row[`${key}High`] = point.high;
      }
    }
  }

  return out.sort((a, b) =>
    String(a.label).slice(0, 10).localeCompare(String(b.label).slice(0, 10))
  );
}

function forecastSeries(
  key: string,
  label: string,
  color: string,
  withBand: boolean
): AdminChartSeries[] {
  const series: AdminChartSeries[] = [
    {
      key: `${key}Forecast`,
      label: `${label} forecast`,
      color,
      strokeDasharray: withBand ? '6 4' : '1 4',
    },
  ];
  if (withBand) {
    series.push(
      {
        key: `${key}High`,
        label: 'High',
        color: FORECAST_BAND_COLOR,
        strokeDasharray: '2 4',
      },
      {
        key: `${key}Low`,
        label: 'Low',
        color: FORECAST_BAND_COLOR,
        strokeDasharray: '2 4',
      }
    );
  }
  return series;
}

function formatPct(pct: number | null): string {
  return pct === null ? '—' : `${pct >= 0 ? '+' : ''}${pct}%`;
}

function ForecastSummary({ driver }: { driver: AdminDatabaseGrowthDriver }) {
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{driver.label}:</span> next
      7 days{' '}
      <span className="tabular-nums">~{driver.next7.toLocaleString()}</span> ·
      next 30 days{' '}
      <span className="tabular-nums">
        ~{driver.next30.toLocaleString()} ({driver.next30Low.toLocaleString()}–
        {driver.next30High.toLocaleString()})
      </span>{' '}
      · trend {formatPct(driver.weeklyGrowthPct)}/wk
      {driver.peakWeekday ? ` · peaks ${driver.peakWeekday}` : ''}
    </p>
  );
}

function isActivityChartView(value: string): value is ActivityChartView {
  return ACTIVITY_CHART_VIEWS.some((v) => v.id === value);
}

function PeriodValue({ color, value }: { color: string; value: number }) {
  return (
    <span className="font-medium tabular-nums" style={{ color }}>
      {value.toLocaleString()}
    </span>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [appVersion, setAppVersion] = useState<AppVersion | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [apiLogStats24h, setApiLogStats24h] = useState<
    Array<{
      hour: string;
      successful: number;
      clientErrors: number;
      serverErrors: number;
      other: number;
    }>
  >([]);
  const [activityChartView, setActivityChartView] =
    useState<ActivityChartView>('flights');
  const [showForecast, setShowForecast] = useState(false);
  const [forecastDrivers, setForecastDrivers] = useState<
    AdminDatabaseGrowthDriver[] | null
  >(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const hasPermission = (permission: string) =>
    Boolean(user?.isAdmin || user?.rolePermissions?.[permission]);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAdminStatistics(timeRange);
      const periodTotals = data.daily.reduce(
        (acc, day) => ({
          total_logins: acc.total_logins + day.logins_count,
          total_sessions: acc.total_sessions + day.new_sessions_count,
          total_flights: acc.total_flights + day.new_flights_count,
          total_users: acc.total_users + day.new_users_count,
        }),
        { total_logins: 0, total_sessions: 0, total_flights: 0, total_users: 0 }
      );
      setStats({ ...data, periodTotals, totals: data.totals });
    } catch (err) {
      console.error('Error fetching admin statistics:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to fetch statistics';
      setError(message);
      setToast({ message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  const fetchVersion = useCallback(async () => {
    if (!user?.isAdmin) return;
    try {
      setVersionLoading(true);
      setAppVersion(await fetchAppVersion());
    } catch (err) {
      console.error('Error fetching app version:', err);
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to fetch app version',
        type: 'error',
      });
    } finally {
      setVersionLoading(false);
    }
  }, [user?.isAdmin]);

  const fetchApiLogStats24hData = useCallback(async () => {
    try {
      setApiLogStats24h(await fetchApiLogStats24h());
    } catch (err) {
      console.error('Error fetching API log stats:', err);
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to fetch API log stats',
        type: 'error',
      });
    }
  }, []);

  useEffect(() => {
    void fetchVersion();
  }, [fetchVersion]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    void fetchApiLogStats24hData();
  }, [fetchApiLogStats24hData]);

  useEffect(() => {
    if (!showForecast || forecastDrivers || forecastLoading) return;
    setForecastLoading(true);
    fetchAdminStatisticsForecast()
      .then((res) => setForecastDrivers(res.drivers))
      .catch((err) => {
        setShowForecast(false);
        setToast({
          message:
            err instanceof Error ? err.message : 'Failed to load forecast',
          type: 'error',
        });
      })
      .finally(() => setForecastLoading(false));
  }, [showForecast, forecastDrivers, forecastLoading]);

  const activityChartData = useMemo(
    () =>
      (stats?.daily ?? []).map((item) => ({
        label: item.date,
        flights: item.new_flights_count,
        sessions: item.new_sessions_count,
        logins: item.logins_count,
        users: item.new_users_count,
      })),
    [stats?.daily]
  );

  const activeActivityView = ACTIVITY_CHART_VIEWS.find(
    (v) => v.id === activityChartView
  )!;

  const singleSeriesChartData = useMemo(() => {
    if (activityChartView === 'accounts') return [];
    return activityChartData.map((row) => ({
      label: row.label,
      value: Number(row[activityChartView]) || 0,
    }));
  }, [activityChartData, activityChartView]);

  const apiChartData = useMemo(
    () =>
      apiLogStats24h.map((item) => ({
        label: item.hour,
        successful: item.successful,
        clientErrors: item.clientErrors,
        serverErrors: item.serverErrors,
        other: item.other,
      })),
    [apiLogStats24h]
  );

  const forecastActive = showForecast && forecastDrivers !== null;

  const forecastChart = useMemo(() => {
    if (!forecastActive) return null;
    if (activityChartView === 'accounts') {
      return {
        data: appendForecast(
          activityChartData,
          ACCOUNTS_SERIES.map((s) => s.key),
          forecastDrivers,
          false
        ),
        series: [
          ...ACCOUNTS_SERIES,
          ...ACCOUNTS_SERIES.flatMap((s) =>
            forecastSeries(s.key, s.label, s.color, false)
          ),
        ],
      };
    }
    const view = activeActivityView;
    return {
      data: appendForecast(
        singleSeriesChartData.map((r) => ({
          label: r.label,
          [view.id]: r.value,
        })),
        [view.id],
        forecastDrivers,
        true
      ),
      series: [
        { key: view.id, label: view.label, color: view.color },
        ...forecastSeries(view.id, view.label, view.color, true),
      ],
    };
  }, [
    forecastActive,
    forecastDrivers,
    activityChartView,
    activityChartData,
    singleSeriesChartData,
    activeActivityView,
  ]);

  const forecastSummaryDrivers = useMemo(() => {
    if (!forecastActive) return [];
    const keys =
      activityChartView === 'accounts'
        ? ['logins', 'users']
        : [activityChartView];
    return keys
      .map((k) =>
        forecastDrivers.find((d) => d.key === FORECAST_DRIVER_BY_KEY[k])
      )
      .filter((d): d is AdminDatabaseGrowthDriver => d !== undefined);
  }, [forecastActive, forecastDrivers, activityChartView]);

  const period = stats?.periodTotals;

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage
        title="Admin Overview"
        icon={BarChart3}
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={String(timeRange)}
            onValueChange={(value) => {
              if (value) setTimeRange(Number(value));
            }}
            aria-label="Time range"
          >
            {TIME_RANGES.map((days) => (
              <ToggleGroupItem
                key={days}
                value={String(days)}
                aria-label={`Last ${days} days`}
                className="tabular-nums"
              >
                {days}d
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      >
        {loading ? (
          <AdminLoading label="Loading statistics…" />
        ) : error ? (
          <AdminErrorState
            title="Error loading statistics"
            message={error}
            onRetry={fetchStats}
          />
        ) : stats ? (
          <>
            <AdminStatCards
              items={[
                {
                  label: 'Total users',
                  value: stats.totals?.total_users ?? 0,
                },
                {
                  label: 'Total sessions',
                  value: stats.totals?.total_sessions ?? 0,
                },
                {
                  label: 'Total flights',
                  value: stats.totals?.total_flights ?? 0,
                },
                {
                  label: 'Total logins',
                  value: stats.totals?.total_logins ?? 0,
                },
              ]}
            />

            <Tabs
              value={activityChartView}
              onValueChange={(value) => {
                if (isActivityChartView(value)) setActivityChartView(value);
              }}
              className="gap-0"
            >
              <AdminSection
                title="Platform activity"
                description={
                  period ? (
                    activityChartView === 'accounts' ? (
                      <>
                        <PeriodValue
                          color={ACCOUNTS_SERIES[0].color}
                          value={period.total_logins}
                        />{' '}
                        logins ·{' '}
                        <PeriodValue
                          color={ACCOUNTS_SERIES[1].color}
                          value={period.total_users}
                        />{' '}
                        new users in the last {timeRange} days
                      </>
                    ) : activeActivityView.periodKey ? (
                      <>
                        <PeriodValue
                          color={activeActivityView.color}
                          value={period[activeActivityView.periodKey]}
                        />{' '}
                        {activeActivityView.label.toLowerCase()} in the last{' '}
                        {timeRange} days
                      </>
                    ) : null
                  ) : null
                }
                actions={
                  <div className="flex items-center gap-2">
                    <Toggle
                      variant="outline"
                      className="gap-1.5 px-3"
                      pressed={showForecast}
                      onPressedChange={setShowForecast}
                      disabled={forecastLoading}
                      aria-label="Show 30-day forecast"
                    >
                      <TrendingUp />
                      Forecast
                    </Toggle>
                    <TabsList aria-label="Platform activity chart">
                      {ACTIVITY_CHART_VIEWS.map((view) => (
                        <TabsTrigger key={view.id} value={view.id}>
                          {view.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                }
              >
                {ACTIVITY_CHART_VIEWS.map((view) => (
                  <TabsContent key={view.id} value={view.id}>
                    {forecastChart && view.id === activityChartView ? (
                      <div className="grid gap-3">
                        <AdminMultiSeriesAreaChart
                          data={forecastChart.data}
                          series={forecastChart.series}
                          height={200}
                          filled={false}
                          showLegend
                        />
                        {forecastSummaryDrivers.map((d) => (
                          <ForecastSummary key={d.key} driver={d} />
                        ))}
                      </div>
                    ) : view.id === 'accounts' ? (
                      <AdminMultiSeriesAreaChart
                        data={activityChartData}
                        series={[...ACCOUNTS_SERIES]}
                        height={200}
                        showLegend
                      />
                    ) : (
                      <AdminAreaChart
                        data={singleSeriesChartData}
                        color={view.color}
                        valueLabel={view.label}
                        height={200}
                      />
                    )}
                  </TabsContent>
                ))}
              </AdminSection>
            </Tabs>

            {hasPermission('audit') ? (
              <AdminSection title="API traffic (24h)">
                <AdminMultiSeriesAreaChart
                  data={apiChartData}
                  series={[...API_SERIES]}
                  height={160}
                  showLegend
                  filled={false}
                />
              </AdminSection>
            ) : null}

            {user?.isAdmin && (
              <AdminSection
                title="Application version"
                actions={
                  <AdminRefreshButton
                    onClick={fetchVersion}
                    loading={versionLoading}
                    iconOnly
                    label="Refresh version"
                    className="size-8"
                  />
                }
              >
                {versionLoading ? (
                  <AdminLoading className="py-4" />
                ) : appVersion ? (
                  <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Version</dt>
                      <dd className="font-mono font-medium">
                        {appVersion.version}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Updated</dt>
                      <dd className="tabular-nums">
                        {new Date(appVersion.updated_at).toLocaleString()}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">By</dt>
                      <dd>{appVersion.updated_by}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No version information.
                  </p>
                )}
              </AdminSection>
            )}
          </>
        ) : (
          <AdminEmptyState icon={BarChart3} title="No statistics available" />
        )}
      </AdminPage>
    </AdminLayout>
  );
}
