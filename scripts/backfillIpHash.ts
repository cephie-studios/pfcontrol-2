import 'dotenv/config';
import { mainDb } from '../server/db/connection.js';
import { decrypt, hashIp } from '../server/utils/encryption.js';

const BATCH_SIZE = 100;

async function run() {
  let offset = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  console.log('Starting ip_hash backfill...');

  while (true) {
    const users = await mainDb
      .selectFrom('users')
      .select(['id', 'ip_address'])
      .where('ip_hash', 'is', null)
      .where('ip_address', 'is not', null)
      .limit(BATCH_SIZE)
      .offset(offset)
      .execute();

    if (users.length === 0) break;

    for (const user of users) {
      try {
        const parsed =
          typeof user.ip_address === 'string'
            ? JSON.parse(user.ip_address)
            : user.ip_address;
        const plainIp = decrypt(parsed) as string;
        if (!plainIp) {
          totalSkipped++;
          continue;
        }

        const ipHash = hashIp(plainIp);

        await mainDb
          .updateTable('users')
          .set({ ip_hash: ipHash })
          .where('id', '=', user.id)
          .execute();

        totalUpdated++;
      } catch (err) {
        console.error(`Failed to process user ${user.id}:`, err);
        totalSkipped++;
      }
    }

    console.log(
      `  Batch at offset ${offset}: ${users.length} processed (${totalUpdated} updated, ${totalSkipped} skipped so far)`
    );
    offset += BATCH_SIZE;
  }

  console.log(
    `\nDone. Updated: ${totalUpdated}, Skipped/errored: ${totalSkipped}`
  );
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
