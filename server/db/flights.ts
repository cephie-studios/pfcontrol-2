import { FlightsDatabase } from "./types/connection/FlightsDatabase.js";
import { validateSessionId } from "../utils/validation.js";
import { flightsDb, mainDb } from "./connection.js";
import { validateFlightId } from "../utils/validation.js";
import { getSessionById } from "./sessions.js";
import { generateRandomId, generateSID, generateSquawk, getWakeTurbulence } from "../utils/flightUtils.js";
import crypto from "crypto";
import { sql } from "kysely";

export interface ClientFlight {
  id: string;
  session_id: string;
  user_id?: string;
  ip_address?: string;
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
  timestamp?: string;
  created_at?: Date;
  updated_at?: Date;
  status?: string;
  clearance?: string;
  position?: object;
  squawk?: string;
  wtc?: string;
  hidden?: boolean;
  acars_token?: string;
  pdc_remarks?: string;
  user?: {
    id: string;
    discord_username: string;
    discord_avatar_url: string | null;
  };
}

function sanitizeFlightForClient(flight: FlightsDatabase[string]): ClientFlight {
    const { user_id, ip_address, cruisingfl, clearedfl, ...sanitizedFlight } = flight;
    return {
        ...sanitizedFlight,
        cruisingFL: cruisingfl,
        clearedFL: clearedfl,
    };
}

function validateFlightFields(updates: Partial<FlightsDatabase>) {
    if (typeof updates.callsign === "string" && (updates.callsign as string).length > 16) {
        throw new Error('Callsign must be 16 characters or less');
    }
    if (typeof updates.stand === "string" && (updates.stand as string).length > 8) {
        throw new Error('Stand must be 8 characters or less');
    }
    if (typeof updates.squawk === "string") {
        if ((updates.squawk as string).length > 4 || !/^\d{1,4}$/.test(updates.squawk as string)) {
            throw new Error('Squawk must be up to 4 numeric digits');
        }
    }
    if (typeof updates.remark === "string" && (updates.remark as string).length > 50) {
        throw new Error('Remark must be 50 characters or less');
    }
    if (updates.cruisingfl !== undefined) {
        const fl = parseInt(String(updates.cruisingfl), 10);
        if (isNaN(fl) || fl < 0 || fl > 200 || fl % 5 !== 0) {
            throw new Error(
                'Cruising FL must be between 0 and 200 in 50-step increments'
            );
        }
    }
    if (updates.clearedfl !== undefined) {
        const fl = parseInt(String(updates.clearedfl), 10);
        if (isNaN(fl) || fl < 0 || fl > 200 || fl % 5 !== 0) {
            throw new Error(
                'Cleared FL must be between 0 and 200 in 50-step increments'
            );
        }
    }
}

export async function getFlightsBySession(sessionId: string) {
  const validSessionId = validateSessionId(sessionId);
  const tableName = `flights_${validSessionId}`;

  let tableExistsResult: boolean;
  try {
    await flightsDb.selectFrom(tableName).select('id').limit(1).execute();
    tableExistsResult = true;
  } catch {
    tableExistsResult = false;
  }

  if (!tableExistsResult) {
    return [];
  }

  try {
    const flights = await flightsDb
      .selectFrom(tableName)
      .selectAll()
      .orderBy('created_at', 'asc')
      .execute();

    const userIds = [...new Set(flights.map(f => f.user_id).filter((id): id is string => typeof id === 'string'))];

    const usersMap = new Map<string, { id: string; discord_username: string; discord_avatar_url: string | null }>();
    if (userIds.length > 0) {
      try {
        const users = await mainDb
          .selectFrom('users')
          .select([
            'id',
            'username as discord_username',
            'avatar as discord_avatar_url'
          ])
          .where('id', 'in', userIds)
          .execute();
    
        users.forEach(user => {
          usersMap.set(user.id, {
            id: user.id,
            discord_username: user.discord_username,
            discord_avatar_url: user.discord_avatar_url
              ? `https://cdn.discordapp.com/avatars/${user.id}/${user.discord_avatar_url}.png`
              : null
          });
        });
      } catch (userError) {
        console.error('Error fetching user data:', userError);
      }
    }

    const enrichedFlights = flights.map(flight => {
        const sanitized = sanitizeFlightForClient(flight as unknown as FlightsDatabase[string]);

        let user = undefined;
        if (flight.user_id && usersMap.has(flight.user_id)) {
            user = usersMap.get(flight.user_id);
        }

        return {
            ...sanitized,
            user,
        };
    });

    return enrichedFlights;
  } catch (error) {
    console.error('Error fetching flights:', error);
    const fallbackFlights = await flightsDb
      .selectFrom(tableName)
      .selectAll()
      .orderBy('created_at', 'asc')
      .execute();
    return fallbackFlights.map((flight) => sanitizeFlightForClient(flight as unknown as FlightsDatabase[string]));
  }
}

export async function validateAcarsAccess(sessionId: string, flightId: string, acarsToken: string) {
  try {
    const validSessionId = validateSessionId(sessionId);
    const validFlightId = validateFlightId(flightId);
    const tableName = `flights_${validSessionId}`;

    const result = await flightsDb
      .selectFrom(tableName)
      .select(['acars_token'])
      .where('id', '=', validFlightId)
      .executeTakeFirst();

    if (!result) {
      return { valid: false };
    }

    const isValid = result.acars_token === acarsToken;

    if (!isValid) {
      return { valid: false };
    }

    const session = await getSessionById(sessionId);

    return {
      valid: true,
      accessId: session?.access_id || null
    };
  } catch (error) {
    console.error('Error validating ACARS access:', error);
    return { valid: false };
  }
}

export async function getFlightsBySessionWithTime(sessionId: string, hoursBack = 2) {
  try {
    const validSessionId = validateSessionId(sessionId);
    const tableName = `flights_${validSessionId}`;

    let tableExistsResult: boolean;
    try {
      await flightsDb.selectFrom(tableName).select('id').limit(1).execute();
      tableExistsResult = true;
    } catch {
      tableExistsResult = false;
    }

    if (!tableExistsResult) {
      return [];
    }

    const sinceDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const flights = await flightsDb
      .selectFrom(tableName)
      .selectAll()
      .where('timestamp', '>=', sinceDate.toISOString())
      .orderBy('timestamp', 'asc')
      .execute();

    return flights.map(flight => sanitizeFlightForClient(flight as unknown as FlightsDatabase[string]));
  } catch (error) {
    console.error(
      `Error fetching flights for session ${sessionId}:`,
      error
    );
    return [];
  }
}

export interface AddFlightData {
  id?: string;
  squawk?: string;
  wtc?: string;
  timestamp?: string;
  acars_token?: string;
  aircraft_type?: string;
  aircraft?: string;
  icao?: string;
  departure?: string;
  runway?: string;
  sid?: string;
  cruisingFL?: number;
  clearedFL?: number;
  cruisingfl?: number;
  clearedfl?: number;
  gate?: string;
  [key: string]: unknown;
}

export async function addFlight(sessionId: string, flightData: AddFlightData) {
  const validSessionId = validateSessionId(sessionId);
  const tableName = `flights_${validSessionId}`;

  try {
    await sql`ALTER TABLE ${sql.table(tableName)} ADD COLUMN IF NOT EXISTS gate VARCHAR(8);`.execute(flightsDb);
  } catch {
    // Column might already exist, continue
  }

  flightData.id = await generateRandomId();
  flightData.squawk = await generateSquawk(flightData);
  flightData.wtc = await getWakeTurbulence(flightData.aircraft || '');
  if (!flightData.timestamp) {
    flightData.timestamp = new Date().toISOString();
  }
  flightData.acars_token = crypto.randomBytes(4).toString('hex');

  if (flightData.aircraft_type) {
    flightData.aircraft = flightData.aircraft_type;
    delete flightData.aircraft_type;
  }

  flightData.icao = flightData.departure;

  if (!flightData.runway) {
    try {
      const session = await getSessionById(validSessionId);
      if (session && session.active_runway) {
        flightData.runway = session.active_runway;
      }
    } catch (error) {
      console.error(
        'Error fetching session for runway assignment:',
        error
      );
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

  const { icao, ...flightDataForDb } = flightData;

  const result = await flightsDb
    .insertInto(tableName)
    .values({
      id: flightDataForDb.id ?? sql`DEFAULT`,
      session_id: validSessionId,
      ...flightDataForDb,
      cruisingfl: flightDataForDb.cruisingfl !== undefined && flightDataForDb.cruisingfl !== null
        ? String(flightDataForDb.cruisingfl)
        : undefined,
      clearedfl: flightDataForDb.clearedfl !== undefined && flightDataForDb.clearedfl !== null
        ? String(flightDataForDb.clearedfl)
        : undefined,
    })
    .returningAll()
    .executeTakeFirst();

  if (!result) {
    throw new Error('Failed to insert flight');
  }

  return sanitizeFlightForClient(result);
}

export async function updateFlight(
  sessionId: string,
  flightId: string,
  updates: Record<string, unknown>
) {
  const validSessionId = validateSessionId(sessionId);
  const validFlightId = validateFlightId(flightId);
  const tableName = `flights_${validSessionId}`;

  const allowedColumns = [
    'callsign', 'aircraft', 'departure', 'arrival', 'flight_type',
    'stand', 'gate', 'runway', 'sid', 'star', 'cruisingFL', 'clearedFL',
    'squawk', 'wtc', 'status', 'remark', 'clearance', 'pdc_remarks', 'hidden'
  ];

  const dbUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    let dbKey = key;
    if (key === 'cruisingFL') dbKey = 'cruisingfl';
    if (key === 'clearedFL') dbKey = 'clearedfl';
    if (allowedColumns.includes(key)) {
      if (dbKey === 'clearance') {
        dbUpdates[dbKey] = String(value);
      } else {
        dbUpdates[dbKey] = value;
      }
    }
  }

  validateFlightFields(dbUpdates as Partial<FlightsDatabase>);

  for (const col of Object.keys(dbUpdates)) {
    try {
      await sql`ALTER TABLE ${sql.table(tableName)} ADD COLUMN IF NOT EXISTS ${sql.raw(`"${col}"`)} TEXT;`.execute(flightsDb);
    } catch (err) {
      console.error('Could not ensure column exists:', col, String(err));
    }
  }

  if (Object.keys(dbUpdates).length === 0) {
    throw new Error('No valid fields to update');
  }

  dbUpdates.updated_at = new Date();

  try {
    await sql`ALTER TABLE ${sql.table(tableName)} ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP;`.execute(flightsDb);
  } catch (err) {
    console.error('Could not ensure column exists:', 'updated_at', String(err));
  }

  const result = await flightsDb
    .updateTable(tableName)
    .set(dbUpdates)
    .where('id', '=', validFlightId)
    .returningAll()
    .executeTakeFirst();

  if (!result) {
    throw new Error('Flight not found or update failed');
  }

  return sanitizeFlightForClient(result as unknown as FlightsDatabase[string]);
}

export async function deleteFlight(sessionId: string, flightId: string) {
  const validSessionId = validateSessionId(sessionId);
  const validFlightId = validateFlightId(flightId);
  const tableName = `flights_${validSessionId}`;
  await flightsDb
    .deleteFrom(tableName)
    .where('id', '=', validFlightId)
    .execute();
}