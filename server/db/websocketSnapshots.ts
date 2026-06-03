import { sql } from 'kysely';
import { mainDb } from './connection.js';
import { recordTableDeletes } from './databaseMetrics.js';

export const WEBSOCKET_SNAPSHOT_RETENTION_DAYS = 1;

export async function persistWebsocketSnapshots(
  samples: Array<{ namespaceId: string; connected: number }>
): Promise<void> {
  if (samples.length === 0) return;

  const sampledAt = new Date();
  try {
    await mainDb
      .insertInto('websocket_snapshots')
      .values(
        samples.map((s) => ({
          namespace_id: s.namespaceId,
          connected_count: s.connected,
          sampled_at: sampledAt,
        }))
      )
      .execute();
  } catch (error) {
    console.error('[websocketSnapshots] persist failed:', error);
  }
}

export async function cleanupOldWebsocketSnapshots(
  daysToKeep = WEBSOCKET_SNAPSHOT_RETENTION_DAYS
): Promise<void> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  try {
    const result = await mainDb
      .deleteFrom('websocket_snapshots')
      .where('sampled_at', '<', cutoff)
      .executeTakeFirst();

    await recordTableDeletes(
      'websocket_snapshots',
      Number(result?.numDeletedRows ?? 0)
    );
  } catch (error) {
    console.error('[websocketSnapshots] cleanup failed:', error);
  }
}

export async function getWebsocketHourlyHistory(): Promise<
  Map<string, number[]>
> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const rows = await sql<{
      namespace_id: string;
      avg_connected: string;
    }>`
      SELECT
        namespace_id,
        ROUND(AVG(connected_count))::text AS avg_connected
      FROM websocket_snapshots
      WHERE sampled_at >= ${since}
      GROUP BY namespace_id, date_trunc('hour', sampled_at)
      ORDER BY date_trunc('hour', sampled_at) ASC
    `.execute(mainDb);

    const result = new Map<string, number[]>();
    for (const row of rows.rows) {
      const list = result.get(row.namespace_id) ?? [];
      list.push(Number(row.avg_connected) || 0);
      result.set(row.namespace_id, list);
    }

    return result;
  } catch (error) {
    console.error('[websocketSnapshots] hourly history failed:', error);
    return new Map();
  }
}
