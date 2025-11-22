import { updateUserStatistics, getUserById } from '../db/users.js';
import { redisConnection } from '../db/connection.js';

const FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STATS_KEY_PREFIX = 'stats_cache:';

export async function incrementStat(
  userId: string,
  key: string,
  value: number = 1,
  subKey?: string
) {
  const redisKey = `${STATS_KEY_PREFIX}${userId}`;
  try {
    if (subKey) {
      const fullKey = `${key}.${subKey}`;
      await redisConnection.hincrbyfloat(redisKey, fullKey, value);
    } else {
      await redisConnection.hincrbyfloat(redisKey, key, value);
    }
    await redisConnection.expire(redisKey, 300);
  } catch (error) {
    console.error(
      `[Redis] Failed to increment stat for user ${userId}:`,
      error
    );
  }
}

async function flushStats() {
  try {
    const keys = await redisConnection.keys(`${STATS_KEY_PREFIX}*`);
    for (const key of keys) {
      const match = key.match(/^stats_cache:([a-zA-Z0-9]+)$/);
      if (!match) continue;

      const userId = match[1];
      const statsHash = await redisConnection.hgetall(key);

      if (Object.keys(statsHash).length > 0) {
        const user = await getUserById(userId);
        const existingStats = user && user.statistics ? user.statistics : {};

        const stats: Record<string, number | Record<string, number>> = {
          ...existingStats,
        };
        for (const [fullKey, val] of Object.entries(statsHash)) {
          const parts = fullKey.split('.');
          if (parts.length === 1) {
            stats[parts[0]] = (Number(stats[parts[0]]) || 0) + parseFloat(val);
          } else {
            if (!stats[parts[0]])
              stats[parts[0]] = {} as Record<string, number>;
            (stats[parts[0]] as Record<string, number>)[parts[1]] =
              ((stats[parts[0]] as Record<string, number>)[parts[1]] || 0) +
              parseFloat(val);
          }
        }

        await updateUserStatistics(userId, stats);
        await redisConnection.del(key);
      }
    }
  } catch (error) {
    console.error('[Redis] Failed to flush stats:', error);
  }
}

export function startStatsFlushing() {
  setInterval(flushStats, FLUSH_INTERVAL);
}

// Flush on shutdown
process.on('SIGINT', async () => {
  await flushStats();
  process.exit();
});
