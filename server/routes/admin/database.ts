import express from "express";
import { requirePermission } from "../../middleware/rolePermissions.js";
import { getDailyStatistics } from "../../db/admin.js";
import {
  fetchPgTableSizes,
  getActivitySummary,
  refreshTodayMetrics,
} from "../../db/databaseMetrics.js";
import {
  buildDatabaseProjection,
  DATABASE_RETENTION_POLICIES,
} from "../../db/databaseProjection.js";

const router = express.Router();

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

router.get("/", requirePermission("admin"), async (_req, res) => {
  try {
    try {
      await refreshTodayMetrics();
    } catch (metricsError) {
      console.error(
        "[admin/database] refreshTodayMetrics failed:",
        metricsError
      );
    }

    const sizes = await fetchPgTableSizes();
    const tables = [...sizes.entries()]
      .map(([name, meta]) => ({
        name,
        bytes: meta.bytes,
        bytesFormatted: formatBytes(meta.bytes),
        rowEstimate: meta.rowEstimate,
        retentionDays: DATABASE_RETENTION_POLICIES.find((p) => p.table === name)
          ?.retentionDays,
      }))
      .sort((a, b) => b.bytes - a.bytes);

    const totalBytes = tables.reduce((s, t) => s + t.bytes, 0);
    const largest = tables[0] ?? null;

    const [activitySummary, dailyStatistics, projectionResult] =
      await Promise.all([
        getActivitySummary(),
        getDailyStatistics(14),
        buildDatabaseProjection(totalBytes, tables),
      ]);

    res.json({
      tables,
      totalBytes,
      totalFormatted: formatBytes(totalBytes),
      largestTable: largest
        ? {
            name: largest.name,
            bytes: largest.bytes,
            formatted: largest.bytesFormatted,
          }
        : null,
      retentionPolicies: DATABASE_RETENTION_POLICIES,
      projection: projectionResult.projection,
      projected30dBytes: projectionResult.projected30dBytes,
      projected30dFormatted: formatBytes(projectionResult.projected30dBytes),
      growthPercent30d: projectionResult.growthPercent30d,
      dailyNetGrowthBytes: projectionResult.dailyNetGrowthBytes,
      dailyNetGrowthFormatted: formatBytes(
        projectionResult.dailyNetGrowthBytes
      ),
      projectionMethodology: projectionResult.methodology,
      activitySummary,
      dailyStatistics: dailyStatistics.map(
        (row: {
          date: Date | string;
          logins_count: number;
          new_sessions_count: number;
          new_flights_count: number;
          new_users_count: number;
        }) => ({
          date:
            row.date instanceof Date
              ? row.date.toISOString().slice(0, 10)
              : String(row.date).slice(0, 10),
          logins: row.logins_count,
          newSessions: row.new_sessions_count,
          newFlights: row.new_flights_count,
          newUsers: row.new_users_count,
        })
      ),
      polledAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching database stats:", error);
    res.status(500).json({ error: "Failed to fetch database statistics" });
  }
});

export default router;