import 'dotenv/config';
import { sql } from 'kysely';
import { mainDb } from '../server/db/connection.js';
import { invalidateUserCache } from '../server/db/users.js';

/**
 * Seeds ip_history with one entry from each user's current ip_address/ip_hash
 * snapshot, so alt detection has real data immediately instead of only
 * growing from each user's next login onward.
 *
 * Unlike backfillIpHash.ts, this needs no per-row JS work (no decryption —
 * ip_address is already the encrypted payload we want to store), so it's one
 * set-based UPDATE rather than a batched loop. Written via raw SQL rather
 * than createOrUpdateUser, so Redis has to be invalidated explicitly here —
 * otherwise anyone already cached would keep showing empty history for up
 * to 24h (the cache TTL).
 */
async function run() {
  console.log('Starting ip_history backfill...');

  const { rows } = await sql<{ id: string }>`
    UPDATE users
    SET ip_history = jsonb_build_array(
      jsonb_build_object(
        'hash', ip_hash,
        'ip', ip_address::jsonb,
        'is_vpn', COALESCE(is_vpn, false),
        'first_seen', COALESCE(created_at, now()),
        'last_seen', COALESCE(created_at, now()),
        'seen_count', 1
      )
    )
    WHERE ip_hash IS NOT NULL
      AND ip_address IS NOT NULL
      AND jsonb_array_length(ip_history) = 0
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
