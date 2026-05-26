import { sql } from "kysely";
import { mainDb } from "./connection.js";
import {
  DATABASE_RETENTION_POLICIES,
  RETENTION_DAYS_BY_TABLE,
} from "./databaseRetention.js";
import {
  getDailyTotalsHistory,
  getTableActivityHistory,
  type TrackedActivityTable,
  TRACKED_ACTIVITY_TABLES,
} from "./databaseMetrics.js";

type TableSizeInput = {
  name: string;
  bytes: number;
  rowEstimate: number;
  retentionDays?: number;
};

type DailyStatRow = {
  date: Date | string;
  logins_count: number | null | undefined;
  new_sessions_count: number | null | undefined;
  new_flights_count: number | null | undefined;
  new_users_count: number | null | undefined;
};

const STAT_TABLE_MAP: Array<{
  stat: keyof Pick<
    DailyStatRow,
    "new_users_count" | "new_sessions_count" | "new_flights_count"
  >;
  table: TrackedActivityTable;
}> = [
  { stat: "new_users_count", table: "users" },
  { stat: "new_sessions_count", table: "sessions" },
  { stat: "new_flights_count", table: "flights" },
];

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function bytesPerRow(bytes: number, rows: number): number {
  if (rows <= 0) return 1024;
  return Math.max(64, bytes / rows);
}

async function getRecentDailyStatistics(days: number): Promise<DailyStatRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return mainDb
    .selectFrom("daily_statistics")
    .select([
      "date",
      mainDb.fn.coalesce("logins_count", sql`0`).as("logins_count"),
      mainDb.fn.coalesce("new_sessions_count", sql`0`).as("new_sessions_count"),
      mainDb.fn.coalesce("new_flights_count", sql`0`).as("new_flights_count"),
      mainDb.fn.coalesce("new_users_count", sql`0`).as("new_users_count"),
    ])
    .where("date", ">=", since)
    .orderBy("date", "asc")
    .execute();
}

export async function buildDatabaseProjection(
  totalBytes: number,
  tables: TableSizeInput[]
): Promise<{
  projection: Array<{ day: number; date: string; projectedBytes: number }>;
  projected30dBytes: number;
  growthPercent30d: number;
  dailyNetGrowthBytes: number;
  methodology: string;
}> {
  const historyDays = 30;
  const totalsHistory = await getDailyTotalsHistory(historyDays);
  const activityHistory = await getTableActivityHistory(historyDays);
  const dailyStats = await getRecentDailyStatistics(historyDays);

  const tableByName = new Map(tables.map((t) => [t.name, t]));

  const netFromTotals: number[] = [];
  for (let i = 1; i < totalsHistory.length; i++) {
    netFromTotals.push(
      totalsHistory[i].totalBytes - totalsHistory[i - 1].totalBytes
    );
  }
  const measuredDailyNet = avg(netFromTotals);

  const activityByTable = new Map<
    string,
    Array<{ inserted: number; deleted: number; bytes: number }>
  >();
  for (const row of activityHistory) {
    const list = activityByTable.get(row.table) ?? [];
    list.push({
      inserted: row.inserted,
      deleted: row.deleted,
      bytes: row.bytes,
    });
    activityByTable.set(row.table, list);
  }

  let logsPerFlight = 8;
  const flightLogActivity = activityByTable.get("flight_logs") ?? [];
  const flightStatSum = dailyStats.reduce(
    (s, d) => s + Number(d.new_flights_count ?? 0),
    0
  );
  const flightLogInserts = flightLogActivity.reduce(
    (s, d) => s + d.inserted,
    0
  );
  if (flightStatSum > 0 && flightLogInserts > 0) {
    logsPerFlight = flightLogInserts / flightStatSum;
  }

  const tableDailyNet = new Map<string, number>();

  for (const tableName of TRACKED_ACTIVITY_TABLES) {
    const meta = tableByName.get(tableName);
    const retention = RETENTION_DAYS_BY_TABLE.get(tableName);
    const history = activityByTable.get(tableName) ?? [];
    const avgRowBytes = bytesPerRow(
      meta?.bytes ?? history[history.length - 1]?.bytes ?? 0,
      meta?.rowEstimate ?? 1
    );

    if (history.length >= 3) {
      const nets = history.map((h) => (h.inserted - h.deleted) * avgRowBytes);
      tableDailyNet.set(tableName, avg(nets));
      continue;
    }

    const statLink = STAT_TABLE_MAP.find((m) => m.table === tableName);
    if (statLink && dailyStats.length > 0) {
      const statAvg = avg(dailyStats.map((d) => Number(d[statLink.stat] ?? 0)));
      tableDailyNet.set(tableName, statAvg * avgRowBytes);
      continue;
    }

    if (tableName === "flight_logs" && dailyStats.length > 0) {
      const flightsAvg = avg(
        dailyStats.map((d) => Number(d.new_flights_count ?? 0))
      );
      tableDailyNet.set(tableName, flightsAvg * logsPerFlight * avgRowBytes);
      continue;
    }

    if (retention && meta) {
      const weeklyInserts = history.reduce((s, h) => s + h.inserted, 0);
      const dailyInsert =
        history.length > 0 ? weeklyInserts / Math.max(history.length, 1) : 0;
      const dailyInsertBytes = dailyInsert * avgRowBytes;
      const rowEst = meta.rowEstimate || 1;
      const dailyDeleteBytes = (rowEst / retention) * avgRowBytes;
      tableDailyNet.set(tableName, dailyInsertBytes - dailyDeleteBytes);
    }
  }

  const activityNetSum = [...tableDailyNet.values()].reduce((s, v) => s + v, 0);

  let dailyNetGrowthBytes: number;
  let methodology: string;

  if (netFromTotals.length >= 7) {
    dailyNetGrowthBytes = measuredDailyNet;
    methodology =
      "30-day forecast from measured daily database size changes (last 7+ days), blended with per-table insert/delete activity.";
  } else if (activityNetSum !== 0 && activityHistory.length >= 14) {
    dailyNetGrowthBytes = activityNetSum;
    methodology =
      "30-day forecast from per-table daily insert/delete history and row-size estimates.";
  } else {
    const statDriven = [...tableDailyNet.values()].reduce((s, v) => s + v, 0);
    dailyNetGrowthBytes = statDriven !== 0 ? statDriven : totalBytes * 0.001;
    methodology =
      statDriven !== 0
        ? "30-day forecast from admin daily statistics (users, sessions, flights) and table activity, with retention adjustments."
        : "Limited history; using conservative 0.1% daily growth estimate until metrics accumulate.";
  }

  if (netFromTotals.length >= 3 && activityNetSum !== 0) {
    dailyNetGrowthBytes = measuredDailyNet * 0.6 + activityNetSum * 0.4;
    methodology =
      "Blended forecast: 60% measured total DB delta, 40% per-table activity and statistics.";
  }

  dailyNetGrowthBytes = Math.max(0, dailyNetGrowthBytes);

  const projection: Array<{
    day: number;
    date: string;
    projectedBytes: number;
  }> = [];
  let projected = totalBytes;
  const today = new Date();

  for (let day = 0; day <= 30; day++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + day);
    projection.push({
      day,
      date: d.toISOString().slice(0, 10),
      projectedBytes: Math.round(Math.max(totalBytes, projected)),
    });
    projected = Math.max(totalBytes, projected + dailyNetGrowthBytes);
  }

  const projected30d = projection[30]?.projectedBytes ?? totalBytes;
  const growthPct =
    totalBytes > 0
      ? Math.max(0, ((projected30d - totalBytes) / totalBytes) * 100)
      : 0;

  return {
    projection,
    projected30dBytes: projected30d,
    growthPercent30d: Math.round(growthPct * 10) / 10,
    dailyNetGrowthBytes: Math.round(dailyNetGrowthBytes),
    methodology,
  };
}

export { DATABASE_RETENTION_POLICIES };