import 'dotenv/config';
import { sql } from 'kysely';
import { mainDb } from '../server/db/connection.js';
import { invalidateUserCache } from '../server/db/users.js';

/**
 * Seeds fingerprint_history with one entry from each user's current
 * fingerprint_id snapshot. See backfillIpHistory.ts for why this is one
 * set-based UPDATE rather than a batched loop, and why it invalidates Redis
 * for every row it touches.
 */
async function run() {
  console.log('Starting fingerprint_history backfill...');

  const { rows } = await sql<{ id: string }>`
    UPDATE users
    SET fingerprint_history = jsonb_build_array(
      jsonb_build_object(
        'fingerprint_id', fingerprint_id,
        'first_seen', COALESCE(created_at, now()),
        'last_seen', COALESCE(created_at, now()),
        'seen_count', 1
      )
    )
    WHERE fingerprint_id IS NOT NULL
      AND jsonb_array_length(fingerprint_history) = 0
    RETURNING id
  `.execute(mainDb);

  await Promise.all(rows.map((row) => invalidateUserCache(row.id)));

  console.log(`Done. Updated: ${rows.length}`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
