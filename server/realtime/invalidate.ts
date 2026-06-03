import { redisConnection } from "../db/connection.js";
import type { ClientFlight } from "../db/flights.js";
import type { NetworkKind } from "../utils/advancedNetworkSession.js";
import { keys } from "./keys.js";
import {
  invalidateSessionFlightsCache,
  setFlightSourceCache,
  invalidateFlightSourceCache,
} from "./flightsRead.js";
import { invalidateArrivalsCache, broadcastArrivalChange } from "./arrivals.js";
import { scheduleOverviewRefresh } from "./overview.js";
import { getOverviewIO } from "./socketRegistry.js";
import { onSessionUsersChanged } from "./activeSessions.js";

export type FlightChangePayload = {
  sessionId: string;
  flightId: string;
  flight?: ClientFlight;
  networkKind?: NetworkKind | null;
  deleted?: boolean;
};

export async function onFlightChanged(
  payload: FlightChangePayload
): Promise<void> {
  const { sessionId, flightId, flight, networkKind, deleted } = payload;

  await invalidateSessionFlightsCache(sessionId);

  if (deleted) {
    await invalidateFlightSourceCache(flightId);
  } else {
    await setFlightSourceCache(flightId, sessionId);
  }

  if (flight?.arrival && networkKind) {
    await invalidateArrivalsCache(flight.arrival, networkKind);
  }

  scheduleOverviewRefresh();

  if (flight && !deleted) {
    const overviewIO = getOverviewIO();
    if (overviewIO) {
      overviewIO.emit("flightUpdated", { sessionId, flight });
    }
    void broadcastArrivalChange(flight, sessionId, networkKind);
  }
}

export async function onSessionUsersChangedInvalidate(
  sessionId: string,
  userCount: number
): Promise<void> {
  await onSessionUsersChanged(sessionId, userCount);
  scheduleOverviewRefresh();
}

export async function onAtisChanged(sessionId: string): Promise<void> {
  try {
    await redisConnection.del(keys.atisDecrypted(sessionId));
  } catch {
    // ignore
  }
  scheduleOverviewRefresh();
}

export async function onChatMessage(sessionId: string): Promise<void> {
  try {
    await redisConnection.del(keys.chatRecent(sessionId));
  } catch {
    // ignore
  }
}
