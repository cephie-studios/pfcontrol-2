import { mainDb } from './connection.js';
import { sql } from 'kysely';

export interface GlobalHolidaySettings {
  id: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
  updated_by: string;
}

export async function initializeGlobalHolidaySettings(): Promise<void> {
  try {
    // Create table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS global_holiday_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT
      )
    `.execute(mainDb);

    // Insert default row if table is empty
    const existing = await mainDb
      .selectFrom('global_holiday_settings')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirst();

    if (!existing) {
      await mainDb
        .insertInto('global_holiday_settings')
        .values({
          id: 1,
          enabled: false,
          created_at: new Date(),
          updated_at: new Date(),
          updated_by: 'system',
        })
        .execute();
    }
  } catch (error) {
    console.error('Error initializing global holiday settings:', error);
    throw error;
  }
}

export async function getGlobalHolidaySettings(): Promise<GlobalHolidaySettings> {
  try {
    const settings = await mainDb
      .selectFrom('global_holiday_settings')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();

    return settings;
  } catch (error) {
    console.error('Error fetching global holiday settings:', error);
    // If table doesn't exist, initialize it
    await initializeGlobalHolidaySettings();
    return getGlobalHolidaySettings();
  }
}

export async function updateGlobalHolidaySettings(
  enabled: boolean,
  updatedBy: string
): Promise<GlobalHolidaySettings> {
  try {
    const updated = await mainDb
      .updateTable('global_holiday_settings')
      .set({
        enabled,
        updated_at: new Date(),
        updated_by: updatedBy,
      })
      .where('id', '=', 1)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated;
  } catch (error) {
    console.error('Error updating global holiday settings:', error);
    throw error;
  }
}
