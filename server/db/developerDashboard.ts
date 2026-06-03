import { mainDb } from "./connection.js";
import { sql } from "kysely";

export async function getDeveloperUsageDailyCounts(
  userId: string,
  since: Date
) {
  const result = await sql<{ date: string; count: number }>`
    SELECT
      to_char(day_bucket, 'YYYY-MM-DD') AS date,
      COALESCE(u.cnt, 0)::int AS count
    FROM generate_series(
      date_trunc('day', ${since}::timestamptz),
      date_trunc('day', now()),
      interval '1 day'
    ) AS day_bucket
    LEFT JOIN (
      SELECT date_trunc('day', created_at) AS d, count(*)::int AS cnt
      FROM developer_api_usage
      WHERE user_id = ${userId}
        AND created_at >= ${since}::timestamptz
      GROUP BY 1
    ) AS u ON u.d = day_bucket
    ORDER BY day_bucket ASC
  `.execute(mainDb);

  return result.rows.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));
}

export async function getDeveloperUsageHourlyCounts(
  userId: string,
  since: Date
) {
  const result = await sql<{ date: string; count: number }>`
    SELECT
      to_char(hour_bucket, 'YYYY-MM-DD"T"HH24:00:00') AS date,
      COALESCE(u.cnt, 0)::int AS count
    FROM generate_series(
      date_trunc('hour', ${since}::timestamptz),
      date_trunc('hour', now()),
      interval '1 hour'
    ) AS hour_bucket
    LEFT JOIN (
      SELECT date_trunc('hour', created_at) AS h, count(*)::int AS cnt
      FROM developer_api_usage
      WHERE user_id = ${userId}
        AND created_at >= ${since}::timestamptz
      GROUP BY 1
    ) AS u ON u.h = hour_bucket
    ORDER BY hour_bucket ASC
  `.execute(mainDb);

  return result.rows.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));
}

export async function getDeveloperUsageByScope(userId: string, since: Date) {
  return mainDb
    .selectFrom("developer_api_usage")
    .select(["scope_id", sql<number>`count(*)::int`.as("count")])
    .where("user_id", "=", userId)
    .where("created_at", ">=", since)
    .groupBy("scope_id")
    .orderBy("count", "desc")
    .execute();
}

export async function getDeveloperRecentUsage(
  userId: string,
  limit: number,
  offset: number
) {
  return mainDb
    .selectFrom("developer_api_usage")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();
}
