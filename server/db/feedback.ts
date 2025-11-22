import { mainDb } from './connection.js';
import { sql } from 'kysely';

export async function getAllFeedback() {
  try {
    const feedback = await mainDb
      .selectFrom('feedback')
      .leftJoin('users', 'feedback.user_id', 'users.id')
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
      .execute();
    return feedback;
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
