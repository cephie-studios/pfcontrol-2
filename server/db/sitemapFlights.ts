import type { Kysely } from 'kysely';
import type { MainDatabase } from './types/connection/MainDatabase.js';

// Only flights a pilot has chosen to feature on their public profile are
// actually linked anywhere public — every other submitted flight is reachable
// at /flight/:id but is never surfaced, so it's excluded from the sitemap.
export async function getSitemapFeaturedFlightIds(
  db: Kysely<MainDatabase>
): Promise<string[]> {
  const rows = await db
    .selectFrom('flights')
    .select('id')
    .where('featured_on_profile', '=', true)
    .execute();

  return rows.map((r) => r.id).sort();
}
