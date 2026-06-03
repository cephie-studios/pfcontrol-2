import {
  getExternalArrivalFlights,
  type ClientFlight,
  type ExternalArrivalFlight,
} from '../db/flights.js';
import { getSessionsByAirportAndNetwork } from '../db/sessions.js';
import { redisConnection } from '../db/connection.js';
import type { NetworkKind } from '../utils/advancedNetworkSession.js';
import { keys, TTL } from './keys.js';
import { perfAsync } from './perf.js';
import { getSessionMeta } from './activeSessions.js';
import { getArrivalsIO } from './socketRegistry.js';

export async function getCachedExternalArrivals(
  airportIcao: string,
  networkKind: NetworkKind
): Promise<ExternalArrivalFlight[]> {
  const cacheKey = keys.arrivals(networkKind, airportIcao);
  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) return JSON.parse(cached) as ExternalArrivalFlight[];
  } catch {
    // ignore
  }

  return perfAsync(
    'getExternalArrivalFlights',
    async () => {
      const flights = await getExternalArrivalFlights(airportIcao, networkKind);
      try {
        await redisConnection.setex(
          cacheKey,
          TTL.ARRIVALS_SEC,
          JSON.stringify(flights)
        );
      } catch {
        // ignore
      }
      return flights;
    },
    { icao: airportIcao, network: networkKind }
  );
}

export async function invalidateArrivalsCache(
  airportIcao: string,
  networkKind: NetworkKind
): Promise<void> {
  try {
    await redisConnection.del(keys.arrivals(networkKind, airportIcao));
    await redisConnection.del(keys.sessionsByAirport(networkKind, airportIcao));
  } catch {
    // ignore
  }
}

async function getArrivalSessionIds(
  airportIcao: string,
  networkKind: NetworkKind
): Promise<string[]> {
  const cacheKey = keys.sessionsByAirport(networkKind, airportIcao);
  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) return JSON.parse(cached) as string[];
  } catch {
    // ignore
  }

  const sessions = await getSessionsByAirportAndNetwork(
    airportIcao,
    networkKind
  );
  const ids = sessions.map((s) => s.session_id);
  try {
    await redisConnection.setex(
      cacheKey,
      TTL.SESSIONS_BY_AIRPORT_SEC,
      JSON.stringify(ids)
    );
  } catch {
    // ignore
  }
  return ids;
}

export async function broadcastArrivalChange(
  flight: ClientFlight,
  sourceSessionId: string,
  networkKind?: NetworkKind | null
): Promise<void> {
  if (!flight.arrival) return;

  let kind = networkKind ?? null;
  if (!kind) {
    const meta = await getSessionMeta(sourceSessionId);
    kind = meta?.networkKind ?? null;
  }
  if (!kind) return;

  const arrivalIcao = flight.arrival.toUpperCase();
  await invalidateArrivalsCache(arrivalIcao, kind);

  const arrivalsIO = getArrivalsIO();
  if (!arrivalsIO) return;

  try {
    const sessionIds = await getArrivalSessionIds(arrivalIcao, kind);
    for (const sessionId of sessionIds) {
      arrivalsIO.to(sessionId).emit('arrivalUpdated', flight);
    }
  } catch (err) {
    console.error('[arrivals] broadcast failed:', err);
  }
}
