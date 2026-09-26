import { sql } from 'kysely';
import { mainDb } from './connection.js';
import {
  DATABASE_RETENTION_POLICIES,
  RETENTION_DAYS_BY_TABLE,
} from './databaseRetention.js';
import {
  getDailyTotalsHistory,
  getTableActivityHistory,
  pgDateKey,
  TRACKED_ACTIVITY_TABLES,
} from './databaseMetrics.js';
import {
  addDaysToKey,
  dateKey,
  densify,
  forecastDailySeries,
  type ForecastPoint,
} from '../utils/dailyForecast.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HORIZON_DAYS = 30;
const HISTORY_DAYS = 56;
const MIN_TABLE_HISTORY_DAYS = 14;

type TableSizeInput = {
  name: string;
  bytes: number;
  rowEstimate: number;
  retentionDays?: number;
};

type Scenario = 'low' | 'value' | 'high';
const SCENARIOS: Scenario[] = ['low', 'value', 'high'];

export type DatabaseProjectionPoint = {
  day: number;
  date: string;
  projectedBytes: number;
  lowBytes: number;
  highBytes: number;
  linearBytes: number | null;
};

export type TableForecast = {
  table: string;
  currentBytes: number;
  projected30dBytes: number;
  deltaBytes: number;
  insertsPerDay: number;
  deletesPerDay: number;
  weeklyGrowthPct: number;
  retentionDays: number | null;
};

export type GrowthDriver = {
  key: 'flights' | 'sessions' | 'users' | 'logins';
  label: string;
  total: number | null;
  last7: number;
  prev7: number;
  last30: number;
  prev30: number | null;
  change30Pct: number | null;
  weeklyGrowthPct: number;
  next7: number;
  next30: number;
  next30Low: number;
  next30High: number;
  peakWeekday: string | null;
  peakFactor: number;
  history: Array<{ date: string; value: number }>;
  forecast: ForecastPoint[];
};

const DRIVERS: Array<{
  key: GrowthDriver['key'];
  label: string;
  column:
    | 'new_flights_count'
    | 'new_sessions_count'
    | 'new_users_count'
    | 'logins_count';
}> = [
  { key: 'flights', label: 'Flights', column: 'new_flights_count' },
  { key: 'sessions', label: 'Sessions', column: 'new_sessions_count' },
  { key: 'users', label: 'New users', column: 'new_users_count' },
  { key: 'logins', label: 'Logins', column: 'logins_count' },
];

function robustDailySlope(
  points: Array<{ day: number; bytes: number }>
): number {
  const slopes: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].day - points[i].day;
      if (dx > 0) slopes.push((points[j].bytes - points[i].bytes) / dx);
    }
  }
  if (slopes.length === 0) return 0;
  slopes.sort((a, b) => a - b);
  const mid = Math.floor(slopes.length / 2);
  return slopes.length % 2 === 0
    ? (slopes[mid - 1] + slopes[mid]) / 2
    : slopes[mid];
}

function bytesPerRow(bytes: number, rows: number): number {
  if (rows <= 0) return 1024;
  return Math.max(64, bytes / rows);
}

function sum(nums: Array<number | null>): number {
  return nums.reduce<number>((s, v) => s + (v ?? 0), 0);
}

function mean(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function getDailyStatisticsSince(since: string) {
  const rows = await mainDb
    .selectFrom('daily_statistics')
    .select([
      'date',
      mainDb.fn.coalesce('logins_count', sql`0`).as('logins_count'),
      mainDb.fn.coalesce('new_sessions_count', sql`0`).as('new_sessions_count'),
      mainDb.fn.coalesce('new_flights_count', sql`0`).as('new_flights_count'),
      mainDb.fn.coalesce('new_users_count', sql`0`).as('new_users_count'),
    ])
    .where('date', '>=', new Date(`${since}T00:00:00Z`))
    .orderBy('date', 'asc')
    .execute();

  return rows.map((r) => ({
    date: pgDateKey(r.date),
    logins_count: Number(r.logins_count),
    new_sessions_count: Number(r.new_sessions_count),
    new_flights_count: Number(r.new_flights_count),
    new_users_count: Number(r.new_users_count),
  }));
}

async function countUsers(): Promise<number> {
  const result = await sql<{ cnt: string }>`
    SELECT COUNT(*)::text AS cnt FROM users
  `.execute(mainDb);
  return Number(result.rows[0]?.cnt ?? 0);
}

async function buildGrowthDrivers(yesterday: string): Promise<GrowthDriver[]> {
  const historyLength = 60;
  const since = addDaysToKey(yesterday, -(historyLength - 1));
  const [stats, totalUsers] = await Promise.all([
    getDailyStatisticsSince(since),
    countUsers(),
  ]);

  const firstTracked = stats[0]?.date ?? null;

  return DRIVERS.map(({ key, label, column }) => {
    const byDate = new Map(stats.map((s) => [s.date, s[column]]));
    const series = densify(byDate, yesterday, historyLength, 0).map((v, i) =>
      firstTracked && addDaysToKey(since, i) < firstTracked ? null : v
    );

    const forecast = forecastDailySeries(
      series.slice(-HISTORY_DAYS),
      yesterday,
      HORIZON_DAYS
    );

    const last30Series = series.slice(-30);
    const prev30Series = series.slice(-60, -30);
    const last30 = sum(last30Series);
    const prev30 = prev30Series.every((v) => v !== null)
      ? sum(prev30Series)
      : null;
    const round1 = (v: number) => Math.round(v * 10) / 10;

    return {
      key,
      label,
      total: key === 'users' ? totalUsers : null,
      last7: sum(series.slice(-7)),
      prev7: sum(series.slice(-14, -7)),
      last30,
      prev30,
      change30Pct:
        prev30 && prev30 > 0
          ? Math.round(((last30 - prev30) / prev30) * 1000) / 10
          : null,
      weeklyGrowthPct: forecast.weeklyGrowthPct,
      next7: Math.round(sum(forecast.points.slice(0, 7).map((p) => p.value))),
      next30: Math.round(sum(forecast.points.map((p) => p.value))),
      next30Low: Math.round(sum(forecast.points.map((p) => p.low))),
      next30High: Math.round(sum(forecast.points.map((p) => p.high))),
      peakWeekday: forecast.peakWeekday,
      peakFactor: forecast.peakFactor,
      history: series.slice(-28).map((v, i) => ({
        date: addDaysToKey(yesterday, i - 27),
        value: v ?? 0,
      })),
      forecast: forecast.points.map((p) => ({
        date: p.date,
        value: round1(p.value),
        low: round1(p.low),
        high: round1(p.high),
      })),
    };
  });
}

export async function getGrowthForecast(): Promise<GrowthDriver[]> {
  return buildGrowthDrivers(addDaysToKey(dateKey(new Date()), -1));
}

function forecastTable(
  meta: TableSizeInput,
  inserts: Array<number | null>,
  deletes: Array<number | null>,
  currentRows: number,
  peakRows: number,
  yesterday: string
): { perDay: Record<Scenario, number[]>; forecast: TableForecast } {
  const retention = RETENTION_DAYS_BY_TABLE.get(meta.name) ?? null;
  const capacityRows = Math.max(peakRows, currentRows);
  const rowBytes = bytesPerRow(meta.bytes, capacityRows);
  const insertForecast = forecastDailySeries(inserts, yesterday, HORIZON_DAYS);
  const recentDeletes = mean(
    deletes.slice(-28).filter((v): v is number => v !== null)
  );

  const perDay = {} as Record<Scenario, number[]>;
  let insertsTotal = 0;
  let deletesTotal = 0;

  for (const scenario of SCENARIOS) {
    const ins = insertForecast.points.map((p) => p[scenario]);
    const bytes: number[] = [];
    let rows = currentRows;
    let peak = capacityRows;

    for (let t = 0; t < HORIZON_DAYS; t++) {
      let del = recentDeletes;
      if (retention !== null) {
        const src = t - retention;
        if (src >= 0) {
          del = ins[src];
        } else {
          const historical = inserts[inserts.length + src];
          if (historical !== null && historical !== undefined) del = historical;
        }
      }

      rows = Math.max(0, rows + ins[t] - del);
      peak = Math.max(peak, rows);
      bytes.push(meta.bytes + (peak - capacityRows) * rowBytes);

      if (scenario === 'value') {
        insertsTotal += ins[t];
        deletesTotal += del;
      }
    }
    perDay[scenario] = bytes;
  }

  const projected = perDay.value[HORIZON_DAYS - 1];
  return {
    perDay,
    forecast: {
      table: meta.name,
      currentBytes: meta.bytes,
      projected30dBytes: Math.round(projected),
      deltaBytes: Math.round(projected - meta.bytes),
      insertsPerDay: Math.round((insertsTotal / HORIZON_DAYS) * 10) / 10,
      deletesPerDay: Math.round((deletesTotal / HORIZON_DAYS) * 10) / 10,
      weeklyGrowthPct: insertForecast.weeklyGrowthPct,
      retentionDays: retention,
    },
  };
}

export async function buildDatabaseProjection(
  totalBytes: number,
  tables: TableSizeInput[]
): Promise<{
  projection: DatabaseProjectionPoint[];
  projected30dBytes: number;
  projected30dLowBytes: number;
  projected30dHighBytes: number;
  growthPercent30d: number;
  dailyNetGrowthBytes: number;
  measuredDailyNetBytes: number | null;
  tableForecasts: TableForecast[];
  growthDrivers: GrowthDriver[];
  methodology: string;
}> {
  const today = dateKey(new Date());
  const yesterday = addDaysToKey(today, -1);

  const [totalsHistory, activityHistory, growthDrivers] = await Promise.all([
    getDailyTotalsHistory(HISTORY_DAYS),
    getTableActivityHistory(HISTORY_DAYS),
    buildGrowthDrivers(yesterday),
  ]);

  const todayMs = Date.parse(today);
  const pastTotals = totalsHistory.filter((t) => t.date < today).slice(-30);
  const measuredDailyNet =
    pastTotals.length >= 3
      ? robustDailySlope([
          ...pastTotals.map((t) => ({
            day: (Date.parse(t.date) - todayMs) / DAY_MS,
            bytes: t.totalBytes,
          })),
          { day: 0, bytes: totalBytes },
        ])
      : null;

  const insertsByTable = new Map<string, Map<string, number>>();
  const deletesByTable = new Map<string, Map<string, number>>();
  const rowCounts = new Map<string, { latest: number; peak: number }>();
  for (const row of activityHistory) {
    const counts = rowCounts.get(row.table) ?? { latest: 0, peak: 0 };
    rowCounts.set(row.table, {
      latest: row.rowCount,
      peak: Math.max(counts.peak, row.rowCount),
    });

    if (row.date >= today) continue;
    if (!insertsByTable.has(row.table)) {
      insertsByTable.set(row.table, new Map());
      deletesByTable.set(row.table, new Map());
    }
    insertsByTable.get(row.table)!.set(row.date, row.inserted);
    deletesByTable.get(row.table)!.set(row.date, row.deleted);
  }

  const tableByName = new Map(tables.map((t) => [t.name, t]));
  const modelled: Array<ReturnType<typeof forecastTable>> = [];
  for (const name of TRACKED_ACTIVITY_TABLES) {
    const meta = tableByName.get(name);
    const insertMap = insertsByTable.get(name);
    if (!meta || !insertMap) continue;

    const inserts = densify(insertMap, yesterday, HISTORY_DAYS);
    const known = inserts.filter((v) => v !== null).length;
    if (known < MIN_TABLE_HISTORY_DAYS) continue;

    const deletes = densify(deletesByTable.get(name)!, yesterday, HISTORY_DAYS);
    const counts = rowCounts.get(name);
    const currentRows = counts?.latest || meta.rowEstimate;
    const peakRows = Math.max(counts?.peak ?? 0, currentRows);
    modelled.push(
      forecastTable(meta, inserts, deletes, currentRows, peakRows, yesterday)
    );
  }

  const projection: DatabaseProjectionPoint[] = [];
  let methodology: string;

  const pushPoint = (day: number, value: number, low: number, high: number) => {
    projection.push({
      day,
      date: addDaysToKey(today, day),
      projectedBytes: Math.round(Math.max(0, value)),
      lowBytes: Math.round(Math.max(0, Math.min(low, value))),
      highBytes: Math.round(Math.max(0, high, value)),
      linearBytes:
        measuredDailyNet === null
          ? null
          : Math.round(Math.max(0, totalBytes + measuredDailyNet * day)),
    });
  };

  if (modelled.length > 0) {
    const modelledBytes = modelled.reduce(
      (s, m) => s + m.forecast.currentBytes,
      0
    );
    const staticBytes = totalBytes - modelledBytes;
    pushPoint(0, totalBytes, totalBytes, totalBytes);
    for (let day = 1; day <= HORIZON_DAYS; day++) {
      const at = (scenario: Scenario) =>
        staticBytes +
        modelled.reduce((s, m) => s + m.perDay[scenario][day - 1], 0);
      pushPoint(day, at('value'), at('low'), at('high'));
    }
    methodology =
      `Per-table forecast for ${modelled.length} tables: 8-week insert trend with weekday pattern, ` +
      'deletes from retention policies, and Postgres space reuse (a table only grows past its previous peak). ' +
      'Range reflects the spread of week-over-week trends.';
  } else {
    const slope = measuredDailyNet ?? 0;
    for (let day = 0; day <= HORIZON_DAYS; day++) {
      const v = totalBytes + slope * day;
      pushPoint(day, v, v, v);
    }
    methodology =
      measuredDailyNet === null
        ? 'Not enough history yet; forecast becomes available after a few days of metrics.'
        : `Not enough per-table history yet; linear trend of measured size over the last ${pastTotals.length} days.`;
  }

  const last = projection[HORIZON_DAYS];
  const projected30d = last?.projectedBytes ?? totalBytes;

  return {
    projection,
    projected30dBytes: projected30d,
    projected30dLowBytes: last?.lowBytes ?? totalBytes,
    projected30dHighBytes: last?.highBytes ?? totalBytes,
    growthPercent30d:
      totalBytes > 0
        ? Math.round(((projected30d - totalBytes) / totalBytes) * 1000) / 10
        : 0,
    dailyNetGrowthBytes: Math.round((projected30d - totalBytes) / HORIZON_DAYS),
    measuredDailyNetBytes:
      measuredDailyNet === null ? null : Math.round(measuredDailyNet),
    tableForecasts: modelled
      .map((m) => m.forecast)
      .sort((a, b) => b.deltaBytes - a.deltaBytes),
    growthDrivers,
    methodology,
  };
}

export { DATABASE_RETENTION_POLICIES };
