import { mainDb } from './connection.js';
import { sql } from 'kysely';

const CATEGORY_RATINGS_REGEX =
  'UI:\\s*\\d+/5,\\s*Performance:\\s*\\d+/5,\\s*Features:\\s*\\d+/5,\\s*Ease of Use:\\s*\\d+/5,\\s*Overall:\\s*\\d+/5';
const CATEGORY_COMMENT_SEPARATOR = '\n\n';

export async function getFeedbackPaginated({
  page = 1,
  limit = 25,
  search = '',
  rating,
  withText = false,
}: {
  page?: number;
  limit?: number;
  search?: string;
  rating?: number;
  withText?: boolean;
} = {}) {
  try {
    const offset = (page - 1) * limit;

    let query = mainDb
      .selectFrom('feedback')
      .leftJoin('users', 'feedback.user_id', 'users.id');

    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      query = query.where((eb) =>
        eb.or([
          eb('feedback.username', 'ilike', `%${trimmedSearch}%`),
          eb('feedback.comment', 'ilike', `%${trimmedSearch}%`),
        ])
      );
    }

    if (rating !== undefined && !Number.isNaN(rating)) {
      query = query.where('feedback.rating', '=', rating);
    }

    if (withText) {
      query = query.where(
        sql<boolean>`CASE
          WHEN feedback.comment ~ ${CATEGORY_RATINGS_REGEX}
            THEN split_part(feedback.comment, ${CATEGORY_COMMENT_SEPARATOR}, 2) <> ''
          ELSE btrim(coalesce(feedback.comment, '')) <> ''
        END`
      );
    }

    const [rows, countResult] = await Promise.all([
      query
        .select([
          'feedback.id',
          'feedback.user_id',
          'feedback.username',
          'feedback.rating',
          'feedback.comment',
          'feedback.created_at',
          'feedback.updated_at',
          'users.avatar',
        ])
        .orderBy('feedback.created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute(),
      query
        .select(({ fn }) => [fn.count<number>('feedback.id').as('total')])
        .executeTakeFirst(),
    ]);

    const total = countResult?.total ? Number(countResult.total) : 0;

    return {
      feedback: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  } catch (error) {
    console.error('Error fetching feedback:', error);
    throw error;
  }
}

export async function addFeedback({
  userId,
  username,
  rating,
  comment,
}: {
  userId: string;
  username: string;
  rating: number;
  comment?: string;
}) {
  try {
    const [feedback] = await mainDb
      .insertInto('feedback')
      .values({
        id: sql`DEFAULT`,
        user_id: userId,
        username,
        rating,
        comment,
      })
      .returningAll()
      .execute();
    return feedback;
  } catch (error) {
    console.error('Error adding feedback:', error);
    throw error;
  }
}

export async function deleteFeedback(id: number) {
  try {
    const [feedback] = await mainDb
      .deleteFrom('feedback')
      .where('id', '=', id)
      .returningAll()
      .execute();
    return feedback;
  } catch (error) {
    console.error('Error deleting feedback:', error);
    throw error;
  }
}

export async function getFeedbackStats() {
  try {
    const stats = await mainDb
      .selectFrom('feedback')
      .select([
        sql<number>`COUNT(*)`.as('total_feedback'),
        sql<number>`AVG(rating)`.as('average_rating'),
        sql<number>`COUNT(CASE WHEN rating = 5 THEN 1 END)`.as('five_star'),
        sql<number>`COUNT(CASE WHEN rating = 4 THEN 1 END)`.as('four_star'),
        sql<number>`COUNT(CASE WHEN rating = 3 THEN 1 END)`.as('three_star'),
        sql<number>`COUNT(CASE WHEN rating = 2 THEN 1 END)`.as('two_star'),
        sql<number>`COUNT(CASE WHEN rating = 1 THEN 1 END)`.as('one_star'),
      ])
      .executeTakeFirst();
    return stats;
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    throw error;
  }
}
