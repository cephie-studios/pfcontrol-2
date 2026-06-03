import { useCallback, useEffect, useMemo, useState } from "react";
import { MdStorage } from "react-icons/md";
import AdminRefreshButton from "../../components/admin/AdminRefreshButton";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminStatStrip from "../../components/admin/AdminStatStrip";
import AdminSectionTitle from "../../components/admin/AdminSectionTitle";
import AdminTable from "../../components/admin/AdminTable";
import {
  adminSectionClass,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TABLE_HEAD,
} from "../../components/admin/adminConstants";
import Loader from "../../components/common/Loader";
import ErrorScreen from "../../components/common/ErrorScreen";
import {
  fetchAdminDatabaseStats,
  type AdminDatabaseStatsResponse,
} from "../../utils/fetch/admin";

export default function AdminDatabase() {
  const [data, setData] = useState<AdminDatabaseStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await fetchAdminDatabaseStats());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load database stats"
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
        name: t.name,
        mb: Math.round((t.bytes / 1024 ** 2) * 10) / 10,
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
      (data?.projection ?? []).map((p) => ({
        date: p.date.slice(5),
        gb: Math.max(0, Math.round((p.projectedBytes / 1024 ** 3) * 100) / 100),
      })),
    [data]
  );

  const growthPercent = Math.max(0, data?.growthPercent30d ?? 0);
  const dailyNetGrowthLabel = data?.dailyNetGrowthFormatted ?? "—";

  const todayLabel = data?.activitySummary?.today ?? "Today";
  const yesterdayLabel = data?.activitySummary?.yesterday ?? "Yesterday";

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Database Monitor"
        icon={MdStorage}
        accent="blue"
        actions={
          <AdminRefreshButton onClick={() => void load()} loading={loading} />
        }
      />

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : error ? (
        <ErrorScreen
          title="Failed to load"
          message={error}
          onRetry={() => void load()}
        />
      ) : data ? (
        <>
          <AdminStatStrip
            items={[
              { label: "Total size", value: data.totalFormatted },
              {
                label: "Est. daily net growth",
                value: dailyNetGrowthLabel,
                sub: data.projectionMethodology,
              },
              {
                label: "30-day projection",
                value: data.projected30dFormatted,
                sub: `+${growthPercent}% vs today`,
              },
            ]}
            columns={3}
          />

          <div
            className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${adminSectionClass("!mt-0 !pt-0 !border-t-0")}`}
          >
            <div>
              <AdminSectionTitle>Table sizes (top 12)</AdminSectionTitle>
              <p className="text-xs text-zinc-500 mb-2">Hover for size in MB</p>
              <div className="h-56 [&_.recharts-surface]:outline-none">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topTables}
                    layout="vertical"
                    margin={{ left: 8, right: 8, top: 4, bottom: 4 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fill: "#a1a1aa", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${v} MB`, "Size"]}
                      labelFormatter={(name) => String(name)}
                      contentStyle={{
                        background: "#09090b",
                        border: "1px solid #3f3f46",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="mb" fill="#60a5fa" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <AdminSectionTitle>Projected size (30 days)</AdminSectionTitle>
              <p className="text-xs text-zinc-500 mb-2">
                Hover for projected size
              </p>
              <div className="h-56 [&_.recharts-surface]:outline-none">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={projectionChart}
                    margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
                  >
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip
                      formatter={(v: number) => [`${v} GB`, "Projected"]}
                      labelFormatter={(label) => String(label)}
                      contentStyle={{
                        background: "#09090b",
                        border: "1px solid #3f3f46",
                        borderRadius: 8,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="gb"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className={adminSectionClass()}>
            <AdminSectionTitle>
              Table activity ({yesterdayLabel} vs {todayLabel})
            </AdminSectionTitle>
            {activityRows.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Activity metrics are collecting — check back after the first
                daily capture.
              </p>
            ) : (
              <AdminTable minWidth="640px">
                <thead className={ADMIN_TABLE_HEAD}>
                  <tr>
                    <th className={ADMIN_TH}>Table</th>
                    <th className={ADMIN_TH}>Inserted ({yesterdayLabel})</th>
                    <th className={ADMIN_TH}>Deleted ({yesterdayLabel})</th>
                    <th className={ADMIN_TH}>Inserted ({todayLabel})</th>
                    <th className={ADMIN_TH}>Deleted ({todayLabel})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {activityRows.map((row) => (
                    <tr key={row.table} className="hover:bg-zinc-800/30">
                      <td className={`${ADMIN_TD} font-mono`}>{row.table}</td>
                      <td className={ADMIN_TD}>
                        {row.yesterday.inserted.toLocaleString()}
                      </td>
                      <td className={ADMIN_TD}>
                        {row.yesterday.deleted.toLocaleString()}
                      </td>
                      <td className={ADMIN_TD}>
                        {row.today.inserted.toLocaleString()}
                      </td>
                      <td className={ADMIN_TD}>
                        {row.today.deleted.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            )}
          </div>

          {recentStats.length > 0 ? (
            <div className={adminSectionClass()}>
              <AdminSectionTitle>
                Platform activity (last 7 days)
              </AdminSectionTitle>
              <AdminTable minWidth="560px">
                <thead className={ADMIN_TABLE_HEAD}>
                  <tr>
                    <th className={ADMIN_TH}>Date</th>
                    <th className={ADMIN_TH}>Logins</th>
                    <th className={ADMIN_TH}>New users</th>
                    <th className={ADMIN_TH}>New sessions</th>
                    <th className={ADMIN_TH}>New flights</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {recentStats.map((row) => (
                    <tr key={row.date} className="hover:bg-zinc-800/30">
                      <td className={ADMIN_TD}>{row.date}</td>
                      <td className={ADMIN_TD}>
                        {row.logins.toLocaleString()}
                      </td>
                      <td className={ADMIN_TD}>
                        {row.newUsers.toLocaleString()}
                      </td>
                      <td className={ADMIN_TD}>
                        {row.newSessions.toLocaleString()}
                      </td>
                      <td className={ADMIN_TD}>
                        {row.newFlights.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            </div>
          ) : null}

          <div className={adminSectionClass()}>
            <AdminSectionTitle>Retention policies</AdminSectionTitle>
            <AdminTable minWidth="480px">
              <thead className={ADMIN_TABLE_HEAD}>
                <tr>
                  <th className={ADMIN_TH}>Table</th>
                  <th className={ADMIN_TH}>Retention</th>
                  <th className={ADMIN_TH}>Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {data.retentionPolicies.map((p) => (
                  <tr key={p.table} className="hover:bg-zinc-800/30">
                    <td className={`${ADMIN_TD} font-mono`}>{p.table}</td>
                    <td className={ADMIN_TD}>{p.retentionDays} days</td>
                    <td className={ADMIN_TD}>{p.label}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
}