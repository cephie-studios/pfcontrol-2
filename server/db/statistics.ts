import { mainDb } from './connection.js';
import { sql } from 'kysely';

export async function recordLogin() {
  try {
    const today = new Date();
    await mainDb
      .insertInto('daily_statistics')
      .values({ id: sql`DEFAULT`, date: today, logins_count: 1 })
      .onConflict((oc) =>
        oc.column('date').doUpdateSet({
          logins_count: sql`daily_statistics.logins_count + 1`,
          updated_at: sql`NOW()`,
        })
      )
      .execute();
  } catch (error) {
    console.error('Error recording login:', error);
  }
}

export async function recordNewSession() {
  try {
    const today = new Date();
    await mainDb
      .insertInto('daily_statistics')
      .values({ id: sql`DEFAULT`, date: today, new_sessions_count: 1 })
      .onConflict((oc) =>
        oc.column('date').doUpdateSet({
          new_sessions_count: sql`daily_statistics.new_sessions_count + 1`,
          updated_at: sql`NOW()`,
        })
      )
      .execute();
  } catch (error) {
    console.error('Error recording new session:', error);
  }
}

export async function recordNewFlight() {
  try {
    const today = new Date();
    await mainDb
      .insertInto('daily_statistics')
      .values({ id: sql`DEFAULT`, date: today, new_flights_count: 1 })
      .onConflict((oc) =>
        oc.column('date').doUpdateSet({
          new_flights_count: sql`daily_statistics.new_flights_count + 1`,
          updated_at: sql`NOW()`,
        })
      )
      .execute();
  } catch (error) {
    console.error('Error recording new flight:', error);
  }
}

export async function recordNewUser() {
  try {
    const today = new Date();
    await mainDb
      .insertInto('daily_statistics')
      .values({ id: sql`DEFAULT`, date: today, new_users_count: 1 })
      .onConflict((oc) =>
        oc.column('date').doUpdateSet({
          new_users_count: sql`daily_statistics.new_users_count + 1`,
          updated_at: sql`NOW()`,
        })
      )
      .execute();
  } catch (error) {
    console.error('Error recording new user:', error);
  }
}

let lastCleanupTime = 0;

export async function cleanupOldStatistics() {
  const now = Date.now();
  const twelveHoursInMs = 12 * 60 * 60 * 1000;

  if (now - lastCleanupTime < twelveHoursInMs) {
    return;
  }

  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await mainDb
      .deleteFrom('daily_statistics')
      .where('date', '<', ninetyDaysAgo)
      .execute();
    lastCleanupTime = now;
  } catch (error) {
    console.error('Error cleaning up old statistics:', error);
  }
}
