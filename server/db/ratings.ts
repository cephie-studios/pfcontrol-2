import { mainDb, redisConnection } from './connection.js';
import { sql } from 'kysely';
import {
  containsProfanity,
  getHateSpeechReason,
} from '../utils/hateSpeechFilter.js';

export async function addControllerRating(
  controllerId: string,
  pilotId: string,
  rating: number,
  flightId?: string,
  sessionId?: string,
  comment?: string
) {
  const trimmedComment = comment && comment.trim() ? comment.trim() : null;
  const automodFlagged = trimmedComment
    ? containsProfanity(trimmedComment)
    : false;

  return await mainDb
    .insertInto('controller_ratings')
    .values({
      controller_id: controllerId,
      pilot_id: pilotId,
      rating: rating,
      flight_id: flightId || null,
      session_id: sessionId || null,
      comment: trimmedComment,
      automod_flagged: automodFlagged,
      automod_reason: automodFlagged
        ? getHateSpeechReason(trimmedComment!)
        : null,
    })
    .execute();
}

export async function getControllerRatingStats(controllerId: string) {
  const result = await mainDb
    .selectFrom('controller_ratings')
    .where('controller_id', '=', controllerId)
    .select(({ fn }) => [
      fn.avg<number>('rating').as('averageRating'),
      fn.count<number>('id').as('ratingCount'),
    ])
    .executeTakeFirst();

  return {
    averageRating: result?.averageRating
      ? parseFloat(result.averageRating.toString())
      : 0,
    ratingCount: result?.ratingCount
      ? parseInt(result.ratingCount.toString())
      : 0,
  };
}

export async function getControllerRatingsForController(
  controllerId: string,
  page = 1,
  limit = 20
) {
  const offset = (page - 1) * limit;

  const [rows, countResult] = await Promise.all([
    mainDb
      .selectFrom('controller_ratings')
      .select([
        'id',
        'rating',
        'comment',
        'reported',
        'automod_flagged',
        'created_at',
      ])
      .where('controller_id', '=', controllerId)
      .where('comment', 'is not', null)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute(),
    mainDb
      .selectFrom('controller_ratings')
      .select(({ fn }) => [fn.count<number>('id').as('total')])
      .where('controller_id', '=', controllerId)
      .where('comment', 'is not', null)
      .executeTakeFirst(),
  ]);

  const total = countResult?.total ? Number(countResult.total) : 0;

  return {
    ratings: rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getControllerRatingsDailyStatsForController(
  controllerId: string,
  days: number = 30
) {
  const cacheKey = `ratings:${controllerId}:daily:${days}`;

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        `[Redis] Failed to read cache for controller daily rating stats (${controllerId}, ${days} days):`,
        error.message
      );
    }
  }

  const dailyStats = await mainDb
    .selectFrom('controller_ratings')
    .select([
      sql<string>`DATE(created_at)`.as('date'),
      (eb) => eb.fn.count<number>('id').as('count'),
      (eb) => eb.fn.avg<number>('rating').as('avg_rating'),
    ])
    .where('controller_id', '=', controllerId)
    .where(
      'created_at',
      '>=',
      sql<Date>`NOW() - INTERVAL '${sql.raw(days.toString())} days'`
    )
    .groupBy(sql`DATE(created_at)`)
    .orderBy(sql`DATE(created_at)`, 'asc')
    .execute();

  try {
    await redisConnection.set(cacheKey, JSON.stringify(dailyStats), 'EX', 120);
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        `[Redis] Failed to set cache for controller daily rating stats (${controllerId}, ${days} days):`,
        error.message
      );
    }
  }

  return dailyStats;
}

export async function getControllerRatingsDistributionForController(
  controllerId: string,
  days: number = 30
) {
  const cacheKey = `ratings:${controllerId}:distribution:${days}`;

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        `[Redis] Failed to read cache for controller rating distribution (${controllerId}, ${days} days):`,
        error.message
      );
    }
  }

  const rows = await mainDb
    .selectFrom('controller_ratings')
    .select(['rating', (eb) => eb.fn.count<number>('id').as('count')])
    .where('controller_id', '=', controllerId)
    .where(
      'created_at',
      '>=',
      sql<Date>`NOW() - INTERVAL '${sql.raw(days.toString())} days'`
    )
    .groupBy('rating')
    .execute();

  const counts = new Map(rows.map((r) => [r.rating, Number(r.count)]));
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: counts.get(rating) ?? 0,
  }));

  try {
    await redisConnection.set(
      cacheKey,
      JSON.stringify(distribution),
      'EX',
      120
    );
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        `[Redis] Failed to set cache for controller rating distribution (${controllerId}, ${days} days):`,
        error.message
      );
    }
  }

  return distribution;
}

export async function reportControllerRating(
  ratingId: number,
  controllerId: string,
  reason: string
) {
  return await mainDb
    .updateTable('controller_ratings')
    .set({
      reported: true,
      report_reason: reason,
      reported_at: new Date(),
    })
    .where('id', '=', ratingId)
    .where('controller_id', '=', controllerId)
    .where('reported', '=', false)
    .returning(['id'])
    .executeTakeFirst();
}

export async function deleteControllerRating(id: number) {
  try {
    const [rating] = await mainDb
      .deleteFrom('controller_ratings')
      .where('id', '=', id)
      .returningAll()
      .execute();
    return rating;
  } catch (error) {
    console.error('Error deleting controller rating:', error);
    throw error;
  }
}
