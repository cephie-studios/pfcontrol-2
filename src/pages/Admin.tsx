import { useState, useEffect, useCallback, useMemo } from "react";
import { MdDashboard, MdSettings } from "react-icons/md";
import AdminRefreshButton from "../components/admin/AdminRefreshButton";
import AdminLayout from "../components/admin/AdminLayout";
import AdminPageHeader from "../components/admin/AdminPageHeader";
import AdminStatCards from "../components/admin/AdminStatCards";
import AdminSectionTitle from "../components/admin/AdminSectionTitle";
import {
  AdminAreaChart,
  AdminMultiSeriesAreaChart,
} from "../components/admin/AdminChart";
import {
  adminDownsizeButtonSize,
  adminSectionClass,
  ADMIN_HEADER_ACTIONS_MOBILE,
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
} from "../components/admin/adminConstants";
import Loader from "../components/common/Loader";
import { useAuth } from "../hooks/auth/useAuth";
import {
  fetchAdminStatistics,
  fetchAppVersion,
  fetchApiLogStats24h,
  type AdminStats,
  type AppVersion,
} from "../utils/fetch/admin";
import Button from "../components/common/Button";
import ErrorScreen from "../components/common/ErrorScreen";

type ActivityChartView = "flights" | "sessions" | "accounts";

const ACTIVITY_CHART_VIEWS: {
  id: ActivityChartView;
  label: string;
  color: string;
  periodKey: "total_flights" | "total_sessions" | null;
  periodLabel?: string;
}[] = [
  {
    id: "flights",
    label: "Flights",
    color: "#a78bfa",
    periodKey: "total_flights",
  },
  {
    id: "sessions",
    label: "Sessions",
    color: "#34d399",
    periodKey: "total_sessions",
  },
  {
    id: "accounts",
    label: "Accounts",
    color: "#60a5fa",
    periodKey: null,
  },
];

const ACCOUNTS_SERIES = [
  { key: "logins", label: "Logins", color: "#60a5fa", strokeDasharray: "2 3" },
  {
    key: "users",
    label: "New users",
    color: "#fbbf24",
    strokeDasharray: "8 4",
  },
] as const;

const API_SERIES = [
  { key: "successful", label: "2xx", color: "#34d399" },
  {
    key: "clientErrors",
    label: "4xx",
    color: "#fbbf24",
    strokeDasharray: "6 4",
  },
  {
    key: "serverErrors",
    label: "5xx",
    color: "#f87171",
    strokeDasharray: "2 3",
  },
  { key: "other", label: "Other", color: "#94a3b8", strokeDasharray: "8 4" },
] as const;

export default function Admin() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
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
    useState<ActivityChartView>("flights");

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
      console.error("Error fetching admin statistics:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch statistics"
      );
      setToast({ message: "Failed to fetch statistics", type: "error" });
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
      console.error("Error fetching app version:", err);
      setToast({ message: "Failed to fetch app version", type: "error" });
    } finally {
      setVersionLoading(false);
    }
  }, [user?.isAdmin]);

  const fetchApiLogStats24hData = useCallback(async () => {
    try {
      setApiLogStats24h(await fetchApiLogStats24h());
    } catch (err) {
      console.error("Error fetching API log stats:", err);
      setToast({ message: "Failed to fetch API log stats", type: "error" });
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
    if (activityChartView === "accounts") return [];
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

  const btnSize = adminDownsizeButtonSize("sm");
  const period = stats?.periodTotals;

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader
        title="Admin Overview"
        icon={MdDashboard}
        accent="blue"
        actionsClassName={ADMIN_HEADER_ACTIONS_MOBILE}
        actions={
          <div className="flex flex-wrap gap-1.5 max-md:w-full">
            {[7, 30, 90, 180, 365].map((days) => (
              <Button
                key={days}
                onClick={() => setTimeRange(days)}
                variant={timeRange === days ? "primary" : "outline"}
                size={btnSize}
              >
                {days}d
              </Button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : error ? (
        <ErrorScreen
          title="Error loading statistics"
          message={error}
          onRetry={fetchStats}
        />
      ) : stats ? (
        <>
          <AdminStatCards
            items={[
              { label: "Total users", value: stats.totals?.total_users ?? 0 },
              {
                label: "Total sessions",
                value: stats.totals?.total_sessions ?? 0,
              },
              {
                label: "Total flights",
                value: stats.totals?.total_flights ?? 0,
              },
              { label: "Total logins", value: stats.totals?.total_logins ?? 0 },
            ]}
          />

          <div className={adminSectionClass("!mt-0 !pt-0 !border-t-0")}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <AdminSectionTitle className="!mb-1">
                  Platform activity
                </AdminSectionTitle>
                <p className="text-xs text-zinc-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>Last {timeRange} days · hover for daily values</span>
                  {period ? (
                    <>
                      <span
                        className="hidden md:inline text-zinc-600"
                        aria-hidden
                      >
                        ·
                      </span>
                      <span className="hidden md:inline">
                        {activityChartView === "accounts" ? (
                          <>
                            <span style={{ color: ACCOUNTS_SERIES[0].color }}>
                              {period.total_logins.toLocaleString()}
                            </span>{" "}
                            logins ·{" "}
                            <span style={{ color: ACCOUNTS_SERIES[1].color }}>
                              {period.total_users.toLocaleString()}
                            </span>{" "}
                            new users in period
                          </>
                        ) : activeActivityView.periodKey ? (
                          <>
                            <span style={{ color: activeActivityView.color }}>
                              {period[
                                activeActivityView.periodKey
                              ].toLocaleString()}
                            </span>{" "}
                            {activeActivityView.label.toLowerCase()} in period
                          </>
                        ) : null}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <div
                className="inline-flex h-9 shrink-0 rounded-full border-2 border-blue-600 overflow-hidden"
                role="group"
                aria-label="Platform activity chart"
              >
                {ACTIVITY_CHART_VIEWS.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    aria-pressed={activityChartView === view.id}
                    onClick={() => setActivityChartView(view.id)}
                    className={`px-3 sm:px-4 h-full text-xs sm:text-sm font-medium transition-colors ${
                      activityChartView === view.id
                        ? ADMIN_SEGMENT_ACTIVE
                        : ADMIN_SEGMENT_INACTIVE
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>

            {activityChartView === "accounts" ? (
              <AdminMultiSeriesAreaChart
                data={activityChartData}
                series={[...ACCOUNTS_SERIES]}
                height={200}
                hideAxes
                showLegend
              />
            ) : (
              <AdminAreaChart
                data={singleSeriesChartData}
                color={activeActivityView.color}
                valueLabel={activeActivityView.label}
                height={200}
                hideAxes
              />
            )}
          </div>

          {hasPermission("audit") ? (
            <div className={adminSectionClass()}>
              <div className="mb-4">
                <AdminSectionTitle className="!mb-1">
                  API traffic
                </AdminSectionTitle>
                <p className="text-xs text-zinc-500">
                  Last 24 hours · hover for hourly values
                </p>
              </div>
              <AdminMultiSeriesAreaChart
                data={apiChartData}
                series={[...API_SERIES]}
                height={160}
                hideAxes
                showLegend
                filled={false}
              />
            </div>
          ) : null}

          {user?.isAdmin && (
            <div className={adminSectionClass()}>
              <div className="flex flex-wrap items-center gap-3">
                <MdSettings size={18} className="text-blue-400 shrink-0" />
                <AdminSectionTitle className="!mb-0 flex-1">
                  Application version
                </AdminSectionTitle>
                <AdminRefreshButton
                  onClick={fetchVersion}
                  loading={versionLoading}
                  iconOnly
                  label="Refresh version"
                />
              </div>
              {versionLoading ? (
                <Loader />
              ) : appVersion ? (
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mt-3">
                  <div>
                    <dt className="text-zinc-500 text-xs">Version</dt>
                    <dd className="text-white font-medium">
                      {appVersion.version}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 text-xs">Updated</dt>
                    <dd className="text-zinc-300">
                      {new Date(appVersion.updated_at).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 text-xs">By</dt>
                    <dd className="text-zinc-300">{appVersion.updated_by}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-zinc-400">
          No statistics available
        </div>
      )}
    </AdminLayout>
  );
}
