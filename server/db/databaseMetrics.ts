import { sql } from "kysely";
import { mainDb } from "./connection.js";

export const TRACKED_ACTIVITY_TABLES = [
  "users",
  "sessions",
  "flights",
  "flight_logs",
  "api_logs",
  "audit_log",
  "developer_api_usage",
  "websocket_snapshots",
  "daily_statistics",
  "session_chat",
  "global_chat",
  "feedback",
  "chat_report",
] as const;

export type TrackedActivityTable = (typeof TRACKED_ACTIVITY_TABLES)[number];

const TABLE_INSERT_TIME_COLUMN: Record<TrackedActivityTable, string> = {
  users: "created_at",
  sessions: "created_at",
  flights: "created_at",
  flight_logs: "created_at",
  api_logs: "created_at",
  audit_log: "created_at",
  developer_api_usage: "created_at",
  websocket_snapshots: "sampled_at",
  daily_statistics: "created_at",
  session_chat: "sent_at",
  global_chat: "sent_at",
  feedback: "created_at",
  chat_report: "created_at",
};

const trackedSet = new Set<string>(TRACKED_ACTIVITY_TABLES);

export function utcDateOnly(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

export function addUtcDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dayRange(date: Date): { start: Date; end: Date } {
  const start = utcDateOnly(date);
  return { start, end: addUtcDays(start, 1) };
}

function sanitizePrevRowCount(prevCount: number, rowCount: number): number {
  if (!Number.isFinite(prevCount) || prevCount < 0) return 0;
  if (prevCount > 2_147_483_647) return 0;
  if (rowCount > 0 && prevCount > rowCount * 2) return 0;
  return prevCount;
}

export async function recordTableDeletes(
  tableName: string,
  count: number
): Promise<void> {
  if (count <= 0 || !trackedSet.has(tableName)) return;

  const today = utcDateOnly(new Date());
  try {
    await sql`
      INSERT INTO daily_table_activity (
        activity_date,
        table_name,
        rows_inserted,
        rows_deleted,
        table_bytes,
        row_count
      )
      VALUES (
        ${today},
        ${tableName},
        0,
        ${count}::bigint,
        0,
        0
      )
      ON CONFLICT (activity_date, table_name) DO UPDATE SET
        rows_deleted = daily_table_activity.rows_deleted + ${count}::bigint,
        updated_at = NOW()
    `.execute(mainDb);
  } catch (error) {
    console.error(`[databaseMetrics] recordTableDeletes(${tableName}):`, error);
  }
}

export async function fetchPgTableSizes(): Promise<
  Map<string, { bytes: number; rowEstimate: number }>
> {
  const sizeRows = await sql<{
    table_name: string;
    total_bytes: string;
    row_estimate: string;
  }>`
    SELECT
      c.relname AS table_name,
      pg_total_relation_size(c.oid)::bigint AS total_bytes,
      COALESCE(c.reltuples, 0)::bigint AS row_estimate
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  `.execute(mainDb);

  const map = new Map<string, { bytes: number; rowEstimate: number }>();
  for (const row of sizeRows.rows) {
    map.set(row.table_name, {
      bytes: Number(row.total_bytes),
      rowEstimate: Number(row.row_estimate),
    });
  }
  return map;
}

async function countRowsInserted(
  tableName: TrackedActivityTable,
  start: Date,
  end: Date
): Promise<number> {
  const timeColumn = TABLE_INSERT_TIME_COLUMN[tableName];
  const result = await sql<{ cnt: string }>`
    SELECT COUNT(*)::text AS cnt
    FROM ${sql.raw(tableName)}
    WHERE ${sql.raw(timeColumn)} >= ${start}
      AND ${sql.raw(timeColumn)} < ${end}
  `.execute(mainDb);
  return Number(result.rows[0]?.cnt ?? 0);
}

async function countTableRows(
  tableName: TrackedActivityTable
): Promise<number> {
  const result = await sql<{ cnt: string }>`
    SELECT COUNT(*)::text AS cnt FROM ${sql.raw(tableName)}
  `.execute(mainDb);
  return Number(result.rows[0]?.cnt ?? 0);
}

async function getActivityRow(
  activityDate: Date,
  tableName: string
): Promise<{
  rows_inserted: number;
  rows_deleted: number;
  table_bytes: number;
  row_count: number;
} | null> {
  const row = await mainDb
    .selectFrom("daily_table_activity")
    .select(["rows_inserted", "rows_deleted", "table_bytes", "row_count"])
    .where("activity_date", "=", activityDate)
    .where("table_name", "=", tableName)
    .executeTakeFirst();
  return row ?? null;
}

export async function hasDailyTotals(activityDate: Date): Promise<boolean> {
  const row = await mainDb
    .selectFrom("daily_database_totals")
    .select("activity_date")
    .where("activity_date", "=", activityDate)
    .executeTakeFirst();
  return !!row;
}

export async function captureDailyMetrics(
  forDate: Date,
  finalize = true
): Promise<void> {
  const activityDate = utcDateOnly(forDate);
  const { start, end } = dayRange(activityDate);
  const sizes = await fetchPgTableSizes();

  let totalBytes = 0;
  for (const [, meta] of sizes) {
    totalBytes += meta.bytes;
  }

  for (const tableName of TRACKED_ACTIVITY_TABLES) {
    try {
      const meta = sizes.get(tableName) ?? { bytes: 0, rowEstimate: 0 };
      const rowsInserted = await countRowsInserted(tableName, start, end);
      const rowCount = await countTableRows(tableName);
      const existing = await getActivityRow(activityDate, tableName);

      let rowsDeleted = Number(existing?.rows_deleted ?? 0);
      if (finalize) {
        const prevDate = addUtcDays(activityDate, -1);
        const prev = await getActivityRow(prevDate, tableName);
        const prevCount = sanitizePrevRowCount(
          Number(prev?.row_count ?? 0),
          rowCount
        );
        const inferred = Math.max(0, prevCount + rowsInserted - rowCount);
        rowsDeleted = Math.max(rowsDeleted, inferred);
      }

      await sql`
        INSERT INTO daily_table_activity (
          activity_date,
          table_name,
          rows_inserted,
          rows_deleted,
          table_bytes,
          row_count
        )
        VALUES (
          ${activityDate},
          ${tableName},
          ${rowsInserted}::bigint,
          ${rowsDeleted}::bigint,
          ${meta.bytes}::bigint,
          ${rowCount}::bigint
        )
        ON CONFLICT (activity_date, table_name) DO UPDATE SET
          rows_inserted = EXCLUDED.rows_inserted,
          rows_deleted = EXCLUDED.rows_deleted,
          table_bytes = EXCLUDED.table_bytes,
          row_count = EXCLUDED.row_count,
          updated_at = NOW()
      `.execute(mainDb);
    } catch (error) {
      console.error(
        `[databaseMetrics] captureDailyMetrics(${tableName}):`,
        error
      );
    }
  }

  if (finalize) {
    await mainDb
      .insertInto("daily_database_totals")
      .values({
        activity_date: activityDate,
        total_bytes: totalBytes,
      })
      .onConflict((oc) =>
        oc.column("activity_date").doUpdateSet({ total_bytes: totalBytes })
      )
      .execute();
  }
}

export async function refreshTodayMetrics(): Promise<void> {
  await captureDailyMetrics(new Date(), false);
}

export async function finalizeYesterdayIfNeeded(): Promise<void> {
  const yesterday = addUtcDays(utcDateOnly(new Date()), -1);
  if (await hasDailyTotals(yesterday)) return;
  await captureDailyMetrics(yesterday, true);
}

export async function backfillRecentActivity(days = 7): Promise<void> {
  const count = await mainDb
    .selectFrom("daily_database_totals")
    .select(sql<number>`COUNT(*)::int`.as("cnt"))
    .executeTakeFirst();
  if (Number(count?.cnt ?? 0) > 0) return;

  for (let i = days; i >= 1; i--) {
    const date = addUtcDays(utcDateOnly(new Date()), -i);
    if (!(await hasDailyTotals(date))) {
      await captureDailyMetrics(date, true);
    }
  }
}

export type TableDayActivity = {
  inserted: number;
  deleted: number;
  bytes: number;
  rowCount: number;
};

export async function getActivitySummary(): Promise<{
  today: string;
  yesterday: string;
  tables: Array<{
    table: string;
    today: TableDayActivity;
    yesterday: TableDayActivity;
  }>;
}> {
  const today = utcDateOnly(new Date());
  const yesterday = addUtcDays(today, -1);

  const empty: TableDayActivity = {
    inserted: 0,
    deleted: 0,
    bytes: 0,
    rowCount: 0,
  };

  const rows = await mainDb
    .selectFrom("daily_table_activity")
    .select([
      "activity_date",
      "table_name",
      "rows_inserted",
      "rows_deleted",
      "table_bytes",
      "row_count",
    ])
    .where("activity_date", "in", [today, yesterday])
    .execute();

  const byDateTable = new Map<string, TableDayActivity>();
  for (const row of rows) {
    const key = `${row.activity_date.toISOString().slice(0, 10)}:${row.table_name}`;
    byDateTable.set(key, {
      inserted: row.rows_inserted,
      deleted: row.rows_deleted,
      bytes: Number(row.table_bytes),
      rowCount: Number(row.row_count),
    });
  }

  const todayKey = today.toISOString().slice(0, 10);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const tables = TRACKED_ACTIVITY_TABLES.map((table) => ({
    table,
    today: byDateTable.get(`${todayKey}:${table}`) ?? { ...empty },
    yesterday: byDateTable.get(`${yesterdayKey}:${table}`) ?? { ...empty },
  }));

  return {
    today: todayKey,
    yesterday: yesterdayKey,
    tables,
  };
}

export async function getDailyTotalsHistory(
  days: number
): Promise<Array<{ date: string; totalBytes: number }>> {
  const since = addUtcDays(utcDateOnly(new Date()), -days);
  const rows = await mainDb
    .selectFrom("daily_database_totals")
    .select(["activity_date", "total_bytes"])
    .where("activity_date", ">=", since)
    .orderBy("activity_date", "asc")
    .execute();

  return rows.map((r) => ({
    date: r.activity_date.toISOString().slice(0, 10),
    totalBytes: Number(r.total_bytes),
  }));
}

export async function getTableActivityHistory(days: number): Promise<
  Array<{
    date: string;
    table: string;
    inserted: number;
    deleted: number;
    bytes: number;
  }>
> {
  const since = addUtcDays(utcDateOnly(new Date()), -days);
  const rows = await mainDb
    .selectFrom("daily_table_activity")
    .select([
      "activity_date",
      "table_name",
      "rows_inserted",
      "rows_deleted",
      "table_bytes",
    ])
    .where("activity_date", ">=", since)
    .orderBy("activity_date", "asc")
    .execute();

  return rows.map((r) => ({
    date: r.activity_date.toISOString().slice(0, 10),
    table: r.table_name,
    inserted: r.rows_inserted,
    deleted: r.rows_deleted,
    bytes: Number(r.table_bytes),
  }));
}

let metricsInterval: NodeJS.Timeout | null = null;
let metricsFinalizeInterval: NodeJS.Timeout | null = null;

export function startDatabaseMetricsCapture(): void {
  stopDatabaseMetricsCapture();

  setTimeout(() => {
    void (async () => {
      try {
        await backfillRecentActivity(7);
        await finalizeYesterdayIfNeeded();
        await refreshTodayMetrics();
      } catch (error) {
        console.error("[databaseMetrics] initial capture failed:", error);
      }
    })();
  }, 90_000);

  metricsInterval = setInterval(
    () => {
      void refreshTodayMetrics().catch((error) => {
        console.error("[databaseMetrics] refresh today failed:", error);
      });
    },
    6 * 60 * 60 * 1000
  );

  metricsFinalizeInterval = setInterval(
    () => {
      void finalizeYesterdayIfNeeded().catch((error) => {
        console.error("[databaseMetrics] finalize yesterday failed:", error);
      });
    },
    24 * 60 * 60 * 1000
  );
}

export function stopDatabaseMetricsCapture(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  if (metricsFinalizeInterval) {
    clearInterval(metricsFinalizeInterval);
    metricsFinalizeInterval = null;
  }
}
