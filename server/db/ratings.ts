import { mainDb } from './connection.js';

export async function addControllerRating(
  controllerId: string,
  pilotId: string,
  rating: number,
  flightId?: string
) {
  return await mainDb
    .insertInto('controller_ratings')
    .values({
      controller_id: controllerId,
      pilot_id: pilotId,
      rating: rating,
      flight_id: flightId || null,
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
    averageRating: result?.averageRating ? parseFloat(result.averageRating.toString()) : 0,
    ratingCount: result?.ratingCount ? parseInt(result.ratingCount.toString()) : 0,
  };
}
