import { mainDb } from './connection.js';
import { redisConnection } from './connection.js';
import { getUserById } from './users.js';

export const STATS_KEYS = [
  'total_sessions_created',
  'total_flights_submitted.total',
  'total_time_controlling_minutes',
  'total_chat_messages_sent',
  'total_flight_edits.total_edit_actions',
];

export async function updateLeaderboard() {
  try {
    const users = await mainDb
      .selectFrom('users')
      .select(['id', 'username', 'statistics'])
      .execute();

    for (const key of STATS_KEYS) {
      const scores: { userId: string; score: number }[] = [];

      for (const user of users) {
        const statsRaw = user.statistics;
        type Stats = Record<string, unknown>;
        let stats: Stats = {};
        if (typeof statsRaw === 'string') {
          try {
            stats = JSON.parse(statsRaw) as Stats;
          } catch {
            stats = {};
          }
        } else if (typeof statsRaw === 'object' && statsRaw !== null) {
          stats = statsRaw as Stats;
        }

        let value = 0;

        if (key.includes('.')) {
          const [parent, child] = key.split('.');
          const parentVal = stats[parent];
          if (
            parentVal &&
            typeof parentVal === 'object' &&
            parentVal !== null
          ) {
            const childVal = (parentVal as Record<string, unknown>)[child];
            if (typeof childVal === 'number') {
              value = childVal;
            } else if (typeof childVal === 'string') {
              const parsed = parseFloat(childVal);
              if (!Number.isNaN(parsed)) value = parsed;
            }
          }
        } else {
          const v = stats[key];
          if (typeof v === 'number') {
            value = v;
          } else if (typeof v === 'string') {
            const parsed = parseFloat(v);
            if (!Number.isNaN(parsed)) value = parsed;
          }
        }

        if (value > 0) {
          scores.push({ userId: user.id, score: value });
        }
      }

      scores.sort(
        (a, b) => b.score - a.score || a.userId.localeCompare(b.userId)
      );

      const zsetKey = `leaderboard:${key}`;
      await redisConnection.del(zsetKey);
      if (scores.length > 0) {
        const zaddArgs = scores.flatMap((s) => [s.score, s.userId]);
        await redisConnection.zadd(zsetKey, ...zaddArgs);
      }
    }
  } catch (error) {
    console.error('[Leaderboard] Update failed:', error);
  }
}

export async function getUserRank(
  userId: string,
  key: string
): Promise<number | null> {
  try {
    const rank = await redisConnection.zrevrank(`leaderboard:${key}`, userId);
    return rank !== null ? rank + 1 : null;
  } catch (error) {
    console.error(
      `[Leaderboard] Failed to get rank for ${userId} on ${key}:`,
      error
    );
    return null;
  }
}

export async function getTopUsers(
  key: string,
  limit: number = 10
): Promise<Array<{ userId: string; username: string; score: number }>> {
  try {
    const top = await redisConnection.zrevrange(
      `leaderboard:${key}`,
      0,
      limit - 1,
      'WITHSCORES'
    );
    const entries = [];
    for (let i = 0; i < top.length; i += 2) {
      const userId = top[i];
      const score = parseFloat(top[i + 1]);

      const user = await getUserById(userId);
      entries.push({
        userId,
        username: user?.username || 'Unknown',
        avatar: user?.avatar || null,
        score,
      });
    }
    return entries;
  } catch (error) {
    console.error(`[Leaderboard] Failed to get top users for ${key}:`, error);
    return [];
  }
}
