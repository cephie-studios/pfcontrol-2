import { mainDb } from './connection.js';
import { validateSessionId, validateFlightId } from '../utils/validation.js';
import { getSessionById } from './sessions.js';
import {
  generateRandomId,
  generateSID,
  generateSquawk,
  getWakeTurbulence,
} from '../utils/flightUtils.js';
import crypto from 'crypto';
import { sql } from 'kysely';
import { incrementStat } from '../utils/statisticsCache.js';
import type { FlightsTable } from './types/connection/main/FlightsTable.js';

function createUTCDate(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds()
    )
  );
}

export interface ClientFlight {
  id: string;
  session_id: string;
  callsign?: string;
  aircraft?: string;
  flight_type?: string;
  departure?: string;
  arrival?: string;
  alternate?: string;
  route?: string;
  sid?: string;
  star?: string;
  runway?: string;
  cruisingFL?: string;
  clearedFL?: string;
  stand?: string;
  gate?: string;
  remark?: string;
  flight_plan_time?: string;
  created_at?: Date;
  updated_at?: Date;
  status?: string;
  clearance?: string;
  position?: object;
  squawk?: string;
  wtc?: string;
  hidden?: boolean;
  pdc_remarks?: string;
  user?: {
    id: string;
    discord_username: string;
    discord_avatar_url: string | null;
  };
}

function sanitizeFlightForClient(flight: FlightsTable): ClientFlight {
  const {
    user_id: _uid,
    ip_address: _ip,
    acars_token: _tok,
    cruisingfl,
    clearedfl,
    ...rest
  } = flight;
  return {
    ...rest,
    cruisingFL: cruisingfl,
    clearedFL: clearedfl,
  };
}

function sanitizeFlightForOwner(
  flight: FlightsTable
): ClientFlight & { acars_token?: string } {
  const { user_id: _uid, ip_address: _ip, cruisingfl, clearedfl, ...rest } =
    flight;
  return {
    ...rest,
    cruisingFL: cruisingfl,
    clearedFL: clearedfl,
  };
}

function validateFlightFields(updates: Partial<FlightsTable>) {
  if (
    typeof updates.callsign === 'string' &&
    updates.callsign.length > 16
  ) {
    throw new Error('Callsign must be 16 characters or less');
  }
  if (typeof updates.callsign === 'string' && updates.callsign.length > 0) {
    if (!/\d/.test(updates.callsign)) {
      throw new Error('Callsign must contain at least one number');
    }
  }
  if (typeof updates.stand === 'string' && updates.stand.length > 8) {
    throw new Error('Stand must be 8 characters or less');
  }
  if (typeof updates.squawk === 'string') {
    const squawk = updates.squawk;
    if (squawk.length > 0 && (squawk.length > 4 || !/^\d{1,4}$/.test(squawk))) {
      throw new Error('Squawk must be up to 4 numeric digits');
    }
  }
  if (typeof updates.remark === 'string' && updates.remark.length > 50) {
    throw new Error('Remark must be 50 characters or less');
  }
  if (updates.cruisingfl !== undefined) {
    const fl = parseInt(String(updates.cruisingfl), 10);
    if (isNaN(fl) || fl < 0 || fl > 500 || fl % 5 !== 0) {
      throw new Error(
        'Cruising FL must be between 0 and 500 in 5-step increments'
      );
    }
  }
  if (updates.clearedfl !== undefined) {
    const fl = parseInt(String(updates.clearedfl), 10);
    if (isNaN(fl) || fl < 0 || fl > 500 || fl % 5 !== 0) {
      throw new Error(
        'Cleared FL must be between 0 and 500 in 5-step increments'
      );
    }
  }
}

export async function getFlightsBySession(sessionId: string) {
  const validSessionId = validateSessionId(sessionId);

  try {
    const flights = await mainDb
      .selectFrom('flights')
      .selectAll()
      .where('session_id', '=', validSessionId)
      .orderBy('created_at', 'asc')
      .execute();

    const userIds = [
      ...new Set(
        flights
          .map((f) => f.user_id)
          .filter((id): id is string => typeof id === 'string')
      ),
    ];

    const usersMap = new Map<
      string,
      { id: string; discord_username: string; discord_avatar_url: string | null }
    >();

    if (userIds.length > 0) {
      try {
        const users = await mainDb
          .selectFrom('users')
          .select(['id', 'username as discord_username', 'avatar as discord_avatar_url'])
          .where('id', 'in', userIds)
          .execute();

        users.forEach((user) => {
          usersMap.set(user.id, {
            id: user.id,
            discord_username: user.discord_username,
            discord_avatar_url: user.discord_avatar_url
              ? `https://cdn.discordapp.com/avatars/${user.id}/${user.discord_avatar_url}.png`
              : null,
          });
        });
      } catch (userError) {
        console.error('Error fetching user data:', userError);
      }
    }

    return flights.map((flight) => ({
      ...sanitizeFlightForClient(flight),
      user: flight.user_id ? usersMap.get(flight.user_id) : undefined,
    }));
  } catch (error) {
    console.error('Error fetching flights:', error);
    return [];
  }
}

export async function validateAcarsAccess(
  sessionId: string,
  flightId: string,
  acarsToken: string
) {
  try {
    const validSessionId = validateSessionId(sessionId);
    const validFlightId = validateFlightId(flightId);

    const result = await mainDb
      .selectFrom('flights')
      .select('acars_token')
      .where('session_id', '=', validSessionId)
      .where('id', '=', validFlightId)
      .executeTakeFirst();

    if (!result || result.acars_token !== acarsToken) {
      return { valid: false };
    }

    const session = await getSessionById(sessionId);
    return { valid: true, accessId: session?.access_id || null };
  } catch (error) {
    console.error('Error validating ACARS access:', error);
    return { valid: false };
  }
}

export async function getFlightsBySessionWithTime(
  sessionId: string,
  hoursBack = 2
) {
  try {
    const validSessionId = validateSessionId(sessionId);

    const sinceDateUTC = createUTCDate();
    sinceDateUTC.setUTCHours(sinceDateUTC.getUTCHours() - hoursBack);
    const sinceIso = sinceDateUTC.toISOString();

    const flights = await mainDb
      .selectFrom('flights')
      .selectAll()
      .where('session_id', '=', validSessionId)
      .where((eb) =>
        eb.or([
          eb('flight_plan_time', '>=', sinceIso),
          eb('updated_at', '>=', sql<Date>`${sinceIso}`),
          eb('created_at', '>=', sql<Date>`${sinceIso}`),
        ])
      )
      .orderBy(
        sql`COALESCE(flight_plan_time::timestamp, created_at, updated_at)`,
        'desc'
      )
      .orderBy('callsign', 'asc')
      .execute();

    const userIds = [
      ...new Set(
        flights
          .map((f) => f.user_id)
          .filter((id): id is string => typeof id === 'string')
      ),
    ];

    const usersMap = new Map<
      string,
      { id: string; discord_username: string; discord_avatar_url: string | null }
    >();

    if (userIds.length > 0) {
      try {
        const users = await mainDb
          .selectFrom('users')
          .select(['id', 'username as discord_username', 'avatar as discord_avatar_url'])
          .where('id', 'in', userIds)
          .execute();

        users.forEach((user) => {
          usersMap.set(user.id, {
            id: user.id,
            discord_username: user.discord_username,
            discord_avatar_url: user.discord_avatar_url
              ? `https://cdn.discordapp.com/avatars/${user.id}/${user.discord_avatar_url}.png`
              : null,
          });
        });
      } catch (userError) {
        console.error('Error fetching user data:', userError);
      }
    }

    return flights.map((flight) => ({
      ...sanitizeFlightForClient(flight),
      user: flight.user_id ? usersMap.get(flight.user_id) : undefined,
    }));
  } catch (error) {
    console.error(`Error fetching flights for session ${sessionId}:`, error);
    return [];
  }
}

export interface AddFlightData {
  id?: string;
  user_id?: string;
  squawk?: string;
  wtc?: string;
  flight_plan_time?: string;
  acars_token?: string;
  aircraft_type?: string;
  aircraft?: string;
  departure?: string;
  runway?: string;
  sid?: string;
  cruisingFL?: number;
  clearedFL?: number;
  cruisingfl?: number | string;
  clearedfl?: number | string;
  [key: string]: unknown;
}

export async function addFlight(sessionId: string, flightData: AddFlightData) {
  const validSessionId = validateSessionId(sessionId);

  flightData.id = await generateRandomId();
  flightData.squawk = await generateSquawk(flightData);
  flightData.wtc = await getWakeTurbulence(
    flightData.aircraft || flightData.aircraft_type || ''
  );
  if (!flightData.flight_plan_time) {
    flightData.flight_plan_time = new Date().toISOString();
  }
  flightData.acars_token = crypto.randomBytes(4).toString('hex');
  flightData.updated_at = createUTCDate();

  if (flightData.aircraft_type) {
    flightData.aircraft = flightData.aircraft_type;
    delete flightData.aircraft_type;
  }

  if (!flightData.runway) {
    try {
      const session = await getSessionById(validSessionId);
      if (session?.active_runway) {
        flightData.runway = session.active_runway;
      }
    } catch (error) {
      console.error('Error fetching session for runway assignment:', error);
    }
  }

  if (!flightData.sid) {
    const sidResult = await generateSID(flightData);
    flightData.sid = sidResult.sid;
  }

  if (flightData.cruisingFL !== undefined) {
    flightData.cruisingfl = flightData.cruisingFL;
    delete flightData.cruisingFL;
  }
  if (flightData.clearedFL !== undefined) {
    flightData.clearedfl = flightData.clearedFL;
    delete flightData.clearedFL;
  }

  // Strip non-column fields
  const { icao: _icao, aircraft_type: _at, ...insertData } = flightData as Record<string, unknown>;

  const result = await mainDb
    .insertInto('flights')
    .values({
      session_id: validSessionId,
      id: String(insertData.id ?? sql`gen_random_uuid()`),
      ...Object.fromEntries(
        Object.entries(insertData).filter(([k]) => k !== 'id').map(([k, v]) => {
          if ((k === 'cruisingfl' || k === 'clearedfl') && v !== undefined && v !== null) {
            return [k, String(v)];
          }
          return [k, v];
        })
      ),
    })
    .returningAll()
    .executeTakeFirst();

  if (!result) throw new Error('Failed to insert flight');

  if (flightData.user_id) {
    incrementStat(String(flightData.user_id), 'total_flights_submitted', 1, 'total');
  }

  return sanitizeFlightForOwner(result);
}

export async function getFlightById(sessionId: string, flightId: string) {
  const validSessionId = validateSessionId(sessionId);
  const validFlightId = validateFlightId(flightId);

  return (
    (await mainDb
      .selectFrom('flights')
      .selectAll()
      .where('session_id', '=', validSessionId)
      .where('id', '=', validFlightId)
      .executeTakeFirst()) ?? null
  );
}

export async function updateFlight(
  sessionId: string,
  flightId: string,
  updates: Record<string, unknown>
) {
  const validSessionId = validateSessionId(sessionId);
  const validFlightId = validateFlightId(flightId);

  const allowedColumns = [
    'callsign', 'aircraft', 'departure', 'arrival', 'flight_type',
    'stand', 'gate', 'runway', 'sid', 'star',
    'cruisingfl', 'clearedfl', 'squawk', 'wtc', 'status',
    'remark', 'clearance', 'pdc_remarks', 'hidden', 'route',
  ];

  const dbUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    let dbKey = key;
    if (key === 'cruisingFL') dbKey = 'cruisingfl';
    if (key === 'clearedFL')  dbKey = 'clearedfl';
    if (allowedColumns.includes(dbKey)) {
      dbUpdates[dbKey] = dbKey === 'clearance' ? String(value) : value;
    }
  }

  validateFlightFields(dbUpdates as Partial<FlightsTable>);

  if (Object.keys(dbUpdates).length === 0) {
    throw new Error('No valid fields to update');
  }
  dbUpdates.updated_at = createUTCDate();

  const result = await mainDb
    .updateTable('flights')
    .set(dbUpdates)
    .where('session_id', '=', validSessionId)
    .where('id', '=', validFlightId)
    .returningAll()
    .executeTakeFirst();

  if (!result) throw new Error('Flight not found or update failed');

  return sanitizeFlightForClient(result);
}

export async function deleteFlight(sessionId: string, flightId: string) {
  const validSessionId = validateSessionId(sessionId);
  const validFlightId = validateFlightId(flightId);
  await mainDb
    .deleteFrom('flights')
    .where('session_id', '=', validSessionId)
    .where('id', '=', validFlightId)
    .execute();
}
