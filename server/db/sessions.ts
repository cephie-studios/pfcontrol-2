import { mainDb } from './connection.js';
import { addFlight } from './flights.js';
import { validateSessionId } from '../utils/validation.js';
import { encrypt } from '../utils/encryption.js';

interface CreateSessionParams {
  sessionId: string;
  accessId: string;
  activeRunway?: string;
  airportIcao: string;
  createdBy: string;
  isPFATC?: boolean;
}

export async function createSession({
  sessionId,
  accessId,
  activeRunway,
  airportIcao,
  createdBy,
  isPFATC,
  isTutorial,
}: CreateSessionParams & { isTutorial?: boolean }) {
  const validSessionId = validateSessionId(sessionId);

  const encryptedAtis = encrypt({
    letter: 'A',
    text: '',
    timestamp: new Date().toISOString(),
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
      atis: encryptedAtis,
    })
    .execute();

  if (isTutorial) {
    await addFlight(sessionId, {
      callsign: 'EXAMPLE123',
      aircraft: 'A320',
      flight_type: 'IFR',
      departure: airportIcao,
      arrival: 'EGKK',
      stand: 'EXAMPLE',
      runway: activeRunway || '',
      sid: 'RADAR VECTORS',
      cruisingFL: 340,
      clearedFL: 140,
      squawk: '1234',
      wtc: 'M',
      status: 'PENDING',
      remark: 'Example',
      hidden: false,
    });
  }
}

export async function getSessionById(sessionId: string) {
  return (
    (await mainDb
      .selectFrom('sessions')
      .selectAll()
      .where('session_id', '=', sessionId)
      .executeTakeFirst()) || null
  );
}

export async function getSessionsByUser(userId: string) {
  return await mainDb
    .selectFrom('sessions')
    .select([
      'session_id',
      'access_id',
      'active_runway',
      'airport_icao',
      'created_at',
      'created_by',
      'is_pfatc',
      'custom_name',
      'refreshed_at',
    ])
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

export async function updateSession(
  sessionId: string,
  updates: Partial<{
    active_runway: string;
    airport_icao: string;
    flight_strips: unknown;
    atis: unknown;
    custom_name: string;
    refreshed_at: Date;
    is_pfatc: boolean;
  }>
) {
  return await mainDb
    .updateTable('sessions')
    .set({
      ...updates,
      airport_icao: updates.airport_icao?.toUpperCase(),
      refreshed_at: updates.refreshed_at
        ? new Date(updates.refreshed_at)
        : undefined,
    })
    .where('session_id', '=', sessionId)
    .returningAll()
    .executeTakeFirst();
}

export async function updateSessionName(sessionId: string, customName: string) {
  return await mainDb
    .updateTable('sessions')
    .set({ custom_name: customName })
    .where('session_id', '=', sessionId)
    .returningAll()
    .executeTakeFirst();
}

export async function deleteSession(sessionId: string) {
  const validSessionId = validateSessionId(sessionId);

  await mainDb
    .deleteFrom('flights')
    .where('session_id', '=', validSessionId)
    .execute();

  await mainDb
    .deleteFrom('session_chat')
    .where('session_id', '=', validSessionId)
    .execute();

  await mainDb
    .deleteFrom('sessions')
    .where('session_id', '=', validSessionId)
    .execute();
}

export async function getAllSessions() {
  return await mainDb
    .selectFrom('sessions')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute();
}
