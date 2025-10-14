import { mainDb, flightsDb } from "./connection";
import { validateSessionId } from "../utils/validation";
import { encrypt } from "../utils/encryption";
import { sql } from "kysely";

interface CreateSessionParams {
  sessionId: string;
  accessId: string;
  activeRunway?: string;
  airportIcao: string;
  createdBy: string;
  isPFATC?: boolean;
}

export async function createSession({ sessionId, accessId, activeRunway, airportIcao, createdBy, isPFATC }: CreateSessionParams) {
  const validSessionId = validateSessionId(sessionId);

  const encryptedAtis = encrypt({
    letter: 'A',
    text: '',
    timestamp: new Date().toISOString()
  });

  await mainDb
    .insertInto('sessions')
    .values({
      session_id: validSessionId,
      access_id: accessId,
      active_runway: activeRunway,
      airport_icao: airportIcao.toUpperCase(),
      created_by: createdBy,
      is_pfatc: isPFATC,
      atis: JSON.stringify(encryptedAtis)
    })
    .execute();

  await flightsDb.schema
    .createTable(`flights_${validSessionId}`)
    .ifNotExists()
    .addColumn('id', 'varchar(36)', (col) => col.primaryKey())
    .addColumn('session_id', 'varchar(8)', (col) => col.notNull())
    .addColumn('user_id', 'varchar(36)')
    .addColumn('ip_address', 'varchar(45)')
    .addColumn('callsign', 'varchar(16)')
    .addColumn('aircraft', 'varchar(16)')
    .addColumn('flight_type', 'varchar(16)')
    .addColumn('departure', 'varchar(4)')
    .addColumn('arrival', 'varchar(4)')
    .addColumn('alternate', 'varchar(4)')
    .addColumn('route', 'text')
    .addColumn('sid', 'varchar(16)')
    .addColumn('star', 'varchar(16)')
    .addColumn('runway', 'varchar(10)')
    .addColumn('clearedfl', 'varchar(8)')
    .addColumn('cruisingfl', 'varchar(8)')
    .addColumn('stand', 'varchar(8)')
    .addColumn('gate', 'varchar(8)')
    .addColumn('remark', 'text')
    .addColumn('timestamp', 'varchar(32)')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('status', 'varchar(16)')
    .addColumn('clearance', 'varchar(16)')
    .addColumn('position', 'jsonb')
    .addColumn('squawk', 'varchar(8)')
    .addColumn('wtc', 'varchar(4)')
    .addColumn('hidden', 'boolean', (col) => col.defaultTo(false))
    .addColumn('acars_token', 'varchar(16)')
    .execute();
}

export async function getSessionById(sessionId: string) {
  return await mainDb
    .selectFrom('sessions')
    .selectAll()
    .where('session_id', '=', sessionId)
    .executeTakeFirst() || null;
}

export async function getSessionsByUser(userId: string) {
  return await mainDb
    .selectFrom('sessions')
    .select(['session_id', 'access_id', 'active_runway', 'airport_icao', 'created_at', 'created_by', 'is_pfatc', 'custom_name', 'refreshed_at'])
    .where('created_by', '=', userId)
    .orderBy('created_at', 'desc')
    .execute();
}

export async function getSessionsByUserDetailed(userId: string) {
  return await mainDb
    .selectFrom('sessions')
    .selectAll()
    .where('created_by', '=', userId)
    .orderBy('created_at', 'desc')
    .execute();
}

export async function updateSession(sessionId: string, updates: Partial<{ active_runway: string; airport_icao: string; flight_strips: string; atis: string; custom_name: string; refreshed_at: Date; is_pfatc: boolean; }>) {
  return await mainDb
    .updateTable('sessions')
    .set({
      ...updates,
      airport_icao: updates.airport_icao?.toUpperCase(),
      refreshed_at: updates.refreshed_at ? new Date(updates.refreshed_at) : undefined
    })
    .where('session_id', '=', sessionId)
    .returningAll()
    .executeTakeFirst();
}

export async function updateSessionName(sessionId: string, customName: string) {
  return await mainDb
    .updateTable('sessions')
    .set({
      custom_name: customName
    })
    .where('session_id', '=', sessionId)
    .returningAll()
    .executeTakeFirst();
}

export async function deleteSession(sessionId: string) {
  const validSessionId = validateSessionId(sessionId);

  await mainDb
    .deleteFrom('sessions')
    .where('session_id', '=', validSessionId)
    .execute();

  await flightsDb.schema
    .dropTable(`flights_${validSessionId}`)
    .ifExists()
    .execute();
}

export async function getAllSessions() {
  return await mainDb
    .selectFrom('sessions')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute();
}