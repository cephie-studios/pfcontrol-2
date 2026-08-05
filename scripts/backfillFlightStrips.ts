/**
 * Backfill flight_strips on the sessions table.
 *
 * The column previously stored encrypted flight data inline on the session row.
 * After the c3edf3a db migration, flights moved to the dedicated `flights` table
 * and nothing writes to flight_strips anymore, leaving the column NULL for all
 * sessions created after that point.
 *
 * This script reads every session that has flight_strips = NULL, queries the
 * flights table for that session, and writes the result back as plain JSONB.
 *
 * Run with:
 *   npx tsx scripts/backfillFlightStrips.ts
 */

import 'dotenv/config';
import { mainDb } from '../server/db/connection.js';
import { sql } from 'kysely';

const BATCH_SIZE = 50;

async function run() {
  let offset = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalEmpty = 0;

  console.log('Starting flight_strips backfill...');

  while (true) {
    const sessions = await mainDb
      .selectFrom('sessions')
      .select(['session_id'])
      .where('flight_strips', 'is', null)
      .limit(BATCH_SIZE)
      .offset(offset)
      .execute();

    if (sessions.length === 0) break;

    for (const session of sessions) {
      try {
        const flights = await mainDb
          .selectFrom('flights')
          .select([
            'id',
            'session_id',
            'user_id',
            'callsign',
            'aircraft',
            'flight_type',
            'departure',
            'arrival',
            'alternate',
            'route',
            'sid',
            'star',
            'runway',
            'clearedfl',
            'cruisingfl',
            'stand',
            'gate',
            'remark',
            'flight_plan_time',
            'status',
            'clearance',
            'squawk',
            'wtc',
            'hidden',
            'pdc_remarks',
            'created_at',
            'updated_at',
          ])
          .where('session_id', '=', session.session_id)
          .where('hidden', '=', false)
          .orderBy('created_at', 'asc')
          .execute();

        if (flights.length === 0) {
          totalEmpty++;
          // Still mark as processed with an empty array so we don't re-visit
          await mainDb
            .updateTable('sessions')
            .set({ flight_strips: sql`'[]'::jsonb` })
            .where('session_id', '=', session.session_id)
            .execute();
          continue;
        }

        await mainDb
          .updateTable('sessions')
          .set({ flight_strips: sql`${JSON.stringify(flights)}::jsonb` })
          .where('session_id', '=', session.session_id)
          .execute();

        totalUpdated++;
      } catch (err) {
        console.error(`Failed to process session ${session.session_id}:`, err);
        totalSkipped++;
      }
    }

    console.log(
      `  Batch at offset ${offset}: ${sessions.length} processed ` +
        `(${totalUpdated} updated, ${totalEmpty} empty, ${totalSkipped} errored so far)`
    );

    // Don't advance offset — the WHERE flight_strips IS NULL filter shrinks
    // the result set as we update rows, so offset 0 always returns the next batch.
  }

  console.log(
    `\nDone. Updated with flights: ${totalUpdated}, Empty sessions: ${totalEmpty}, Errored: ${totalSkipped}`
  );
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
