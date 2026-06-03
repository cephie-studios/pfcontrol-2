export const DATABASE_RETENTION_POLICIES: Array<{
  table: string;
  retentionDays: number;
  label: string;
}> = [
  { table: "daily_statistics", retentionDays: 365, label: "Daily statistics" },
  { table: "api_logs", retentionDays: 1, label: "API logs" },
  {
    table: "websocket_snapshots",
    retentionDays: 1,
    label: "WebSocket snapshots",
  },
  { table: "audit_log", retentionDays: 14, label: "Audit log" },
  { table: "flight_logs", retentionDays: 365, label: "Flight logs" },
  {
    table: "developer_api_usage",
    retentionDays: 90,
    label: "Developer API usage",
  },
];

export const RETENTION_DAYS_BY_TABLE = new Map(
  DATABASE_RETENTION_POLICIES.map((p) => [p.table, p.retentionDays])
);
