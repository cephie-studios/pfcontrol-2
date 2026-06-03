import { sql } from "kysely";
import { mainDb } from "../db/connection.js";
import { redisConnection } from "../db/connection.js";
import { sanitizeFlightForClient, type ClientFlight } from "../db/flights.js";
import { validateSessionId } from "../utils/validation.js";
import { keys, TTL } from "./keys.js";
import { perfAsync } from "./perf.js";
import { getUserBadgesByIds } from "./userCache.js";

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

function sinceIsoHours(hoursBack: number): string {
  const since = createUTCDate();
  since.setUTCHours(since.getUTCHours() - hoursBack);
  return since.toISOString();
}

async function attachUsersToFlights(
  rows: { flight: ClientFlight; userId?: string | null }[]
): Promise<ClientFlight[]> {
  const userIds = [
    ...new Set(
      rows
        .map((r) => r.userId)
        .filter((id): id is string => typeof id === "string")
    ),
  ];

  const badges = await getUserBadgesByIds(userIds);
  return rows.map(({ flight, userId }) => {
    if (!userId) return flight;
    const badge = badges.get(userId);
    if (!badge) return flight;
    return {
      ...flight,
      user: {
        id: userId,
        discord_username: badge.username ?? "Unknown",
        discord_avatar_url: badge.avatar,
      },
    };
  });
}

export async function getFlightsForSessions(
  sessionIds: string[],
  hoursBack = 1
): Promise<Map<string, ClientFlight[]>> {
  const grouped = new Map<string, ClientFlight[]>();
  if (sessionIds.length === 0) return grouped;

  const validIds = sessionIds.map((id) => validateSessionId(id));
  const sinceIso = sinceIsoHours(hoursBack);

  return perfAsync(
    "getFlightsForSessions",
    async () => {
      const rows = await mainDb
        .selectFrom("flights")
        .selectAll()
        .where("session_id", "in", validIds)
        .where((eb) =>
          eb.or([
            eb("flight_plan_time", ">=", sinceIso),
            eb("updated_at", ">=", sql<Date>`${sinceIso}`),
            eb("created_at", ">=", sql<Date>`${sinceIso}`),
          ])
        )
        .orderBy(
          sql`COALESCE(flight_plan_time::timestamp, created_at, updated_at)`,
          "desc"
        )
        .execute();

      const pairs = rows.map((f) => ({
        flight: sanitizeFlightForClient(f),
        userId: f.user_id,
      }));
      const withUsers = await attachUsersToFlights(pairs);

      for (const id of validIds) {
        grouped.set(id, []);
      }
      for (const flight of withUsers) {
        const list = grouped.get(flight.session_id);
        if (list) list.push(flight);
      }
      return grouped;
    },
    { sessionCount: validIds.length }
  );
}

export async function getFlightsForSessionCached(
  sessionId: string,
  hoursBack = 2
): Promise<ClientFlight[]> {
  const validSessionId = validateSessionId(sessionId);
  const cacheKey = keys.sessionFlights(validSessionId);

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) return JSON.parse(cached) as ClientFlight[];
  } catch {
    // ignore
  }

  const map = await getFlightsForSessions([validSessionId], hoursBack);
  const flights = map.get(validSessionId) ?? [];

  try {
    await redisConnection.setex(
      cacheKey,
      TTL.SESSION_FLIGHTS_SEC,
      JSON.stringify(flights)
    );
  } catch {
    // ignore
  }

  return flights;
}

export async function getAllFlightsForSession(
  sessionId: string
): Promise<ClientFlight[]> {
  const validSessionId = validateSessionId(sessionId);

  const rows = await mainDb
    .selectFrom("flights")
    .selectAll()
    .where("session_id", "=", validSessionId)
    .orderBy(
      sql`COALESCE(flight_plan_time::timestamp, created_at, updated_at)`,
      "desc"
    )
    .execute();

  const pairs = rows.map((f) => ({
    flight: sanitizeFlightForClient(f),
    userId: f.user_id,
  }));
  return attachUsersToFlights(pairs);
}

export async function invalidateSessionFlightsCache(
  sessionId: string
): Promise<void> {
  try {
    await redisConnection.del(
      keys.sessionFlights(validateSessionId(sessionId))
    );
  } catch {
    // ignore
  }
}

export async function setFlightSourceCache(
  flightId: string,
  sessionId: string
): Promise<void> {
  try {
    await redisConnection.setex(
      keys.flightSource(flightId),
      TTL.FLIGHT_SOURCE_SEC,
      validateSessionId(sessionId)
    );
  } catch {
    // ignore
  }
}

export async function getFlightSourceSessionId(
  flightId: string
): Promise<string | null> {
  try {
    const cached = await redisConnection.get(keys.flightSource(flightId));
    if (cached) return cached;
  } catch {
    // ignore
  }
  return null;
}

export async function invalidateFlightSourceCache(
  flightId: string
): Promise<void> {
  try {
    await redisConnection.del(keys.flightSource(flightId));
  } catch {
    // ignore
  }
}
