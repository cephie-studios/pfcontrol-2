import { redisConnection } from "../db/connection.js";
import { decrypt } from "../utils/encryption.js";
import type { ClientFlight } from "../db/flights.js";
import { keys, TTL } from "./keys.js";
import { perfAsync } from "./perf.js";
import {
  getActiveNetworkSessionIds,
  getSessionMetas,
  type SessionMeta,
} from "./activeSessions.js";
import { getFlightsForSessions } from "./flightsRead.js";
import { getUserBadgesByIds } from "./userCache.js";

type SectorController = {
  id: string;
  username: string;
  avatar: string | null;
  station: string;
  joinedAt: number;
};

async function getActiveSectorControllersFromRedis(): Promise<
  SectorController[]
> {
  try {
    const controllers = await redisConnection.hgetall(
      "activeSectorControllers"
    );
    return Object.values(controllers).map(
      (data) => JSON.parse(data as string) as SectorController
    );
  } catch {
    return [];
  }
}

export type OverviewController = {
  username: string;
  role: string;
  avatar: string | null;
  hasVatsimRating?: boolean;
  isEventController?: boolean;
  isPFATCSectorController?: boolean;
  isAATCSectorController?: boolean;
};

export type OverviewSession = {
  sessionId: string;
  airportIcao: string;
  activeRunway: string | null;
  createdAt: string | null;
  createdBy: string;
  isPFATC: boolean;
  isAdvancedATC: boolean;
  activeUsers: number;
  controllers: OverviewController[];
  atis: { letter: string; text: string; timestamp: string } | null;
  flights: ClientFlight[];
  flightCount: number;
};

export type OverviewData = {
  activeSessions: OverviewSession[];
  totalActiveSessions: number;
  totalFlights: number;
  arrivalsByAirport: Record<
    string,
    (ClientFlight & { sessionId: string; departureAirport: string })[]
  >;
  lastUpdated: string;
};

type SessionUsersReader = {
  getActiveUsersForSession: (sessionId: string) => Promise<
    Array<{
      id: string;
      username: string;
      avatar: string | null;
      position: string;
      roles?: Array<{ name: string }>;
    }>
  >;
};

const OVERVIEW_CACHE_ENABLED = process.env.OVERVIEW_CACHE !== "0";

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight = false;

async function getDecryptedAtis(
  sessionId: string,
  encryptedAtis: unknown
): Promise<{ letter: string; text: string; timestamp: string } | null> {
  if (!encryptedAtis) return null;
  const cacheKey = keys.atisDecrypted(sessionId);
  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // ignore
  }
  try {
    const encrypted =
      typeof encryptedAtis === "string"
        ? JSON.parse(encryptedAtis)
        : encryptedAtis;
    const atisData = decrypt(encrypted);
    if (atisData) {
      await redisConnection.setex(
        cacheKey,
        TTL.ATIS_DECRYPTED_SEC,
        JSON.stringify(atisData)
      );
    }
    return atisData;
  } catch (err) {
    console.error("Error decrypting ATIS:", err);
    return null;
  }
}

export async function buildOverviewSnapshot(
  sessionUsersIO: SessionUsersReader
): Promise<OverviewData> {
  return perfAsync("buildOverviewSnapshot", async () => {
    const sectorControllers = await getActiveSectorControllersFromRedis();
    const activeSessionIds = await getActiveNetworkSessionIds();
    const metas = await getSessionMetas(activeSessionIds);

    const sessionUsersEntries = await Promise.all(
      activeSessionIds.map(async (sessionId) => {
        const users = await sessionUsersIO.getActiveUsersForSession(sessionId);
        return { sessionId, users, count: users.length };
      })
    );

    const activeWithUsers = sessionUsersEntries.filter((e) => e.count > 0);
    const activeIds = activeWithUsers.map((e) => e.sessionId);
    const flightsBySession = await getFlightsForSessions(activeIds, 1);

    const controllerUserIds = activeWithUsers.flatMap((e) =>
      e.users.map((u) => u.id).filter(Boolean)
    );
    const sectorUserIds = sectorControllers.map((c) => c.id);
    const badges = await getUserBadgesByIds([
      ...controllerUserIds,
      ...sectorUserIds,
    ]);

    const activeSessions: OverviewSession[] = [];

    for (const { sessionId, users } of activeWithUsers) {
      const meta = metas.get(sessionId);
      if (!meta) continue;

      const flights = flightsBySession.get(sessionId) ?? [];
      let atisData = null;
      if (meta.hasAtis) {
        const { getSessionById } = await import("../db/sessions.js");
        const fullSession = await getSessionById(sessionId);
        if (fullSession?.atis) {
          atisData = await getDecryptedAtis(sessionId, fullSession.atis);
        }
      }

      const controllers: OverviewController[] = users.map((user) => {
        const badge = badges.get(user.id);
        return {
          username: user.username || "Unknown",
          role: user.position || "APP",
          avatar: badge?.avatar ?? user.avatar,
          hasVatsimRating: badge?.hasVatsimRating ?? false,
          isEventController: badge?.isEventController ?? false,
          isPFATCSectorController: badge?.isPFATCSectorController ?? false,
          isAATCSectorController: badge?.isAATCSectorController ?? false,
        };
      });

      activeSessions.push({
        sessionId: meta.sessionId,
        airportIcao: meta.airportIcao,
        activeRunway: meta.activeRunway,
        createdAt: meta.createdAt,
        createdBy: meta.createdBy,
        isPFATC: meta.isPFATC,
        isAdvancedATC: meta.isAdvancedATC,
        activeUsers: users.length,
        controllers,
        atis: atisData,
        flights,
        flightCount: flights.length,
      });
    }

    for (const sectorController of sectorControllers) {
      const badge = badges.get(sectorController.id);
      let avatar = sectorController.avatar;
      if (badge?.avatar && !avatar) avatar = badge.avatar;

      activeSessions.push({
        sessionId: `sector-${sectorController.id}`,
        airportIcao: sectorController.station,
        activeRunway: null,
        createdAt: new Date(sectorController.joinedAt).toISOString(),
        createdBy: sectorController.id,
        isPFATC: true,
        isAdvancedATC: false,
        activeUsers: 1,
        controllers: [
          {
            username: sectorController.username || "Unknown",
            role: "CTR",
            avatar,
            hasVatsimRating: badge?.hasVatsimRating ?? false,
            isEventController: badge?.isEventController ?? false,
          },
        ],
        atis: null,
        flights: [],
        flightCount: 0,
      });
    }

    const arrivalsByAirport: OverviewData["arrivalsByAirport"] = {};
    for (const session of activeSessions) {
      for (const flight of session.flights) {
        if (!flight.arrival) continue;
        const arrivalIcao = flight.arrival.toUpperCase();
        if (!arrivalsByAirport[arrivalIcao])
          arrivalsByAirport[arrivalIcao] = [];
        arrivalsByAirport[arrivalIcao].push({
          ...flight,
          sessionId: session.sessionId,
          departureAirport: session.airportIcao,
        });
      }
    }

    return {
      activeSessions,
      totalActiveSessions: activeSessions.length,
      totalFlights: activeSessions.reduce((sum, s) => sum + s.flightCount, 0),
      arrivalsByAirport,
      lastUpdated: new Date().toISOString(),
    };
  });
}

export async function getCachedOverview(): Promise<OverviewData | null> {
  if (!OVERVIEW_CACHE_ENABLED) return null;
  try {
    const raw = await redisConnection.get(keys.overviewSnapshot());
    if (raw) return JSON.parse(raw) as OverviewData;
  } catch {
    // ignore
  }
  return null;
}

async function storeOverviewSnapshot(data: OverviewData): Promise<void> {
  if (!OVERVIEW_CACHE_ENABLED) return;
  try {
    await redisConnection.setex(
      keys.overviewSnapshot(),
      TTL.OVERVIEW_SNAPSHOT_SEC,
      JSON.stringify(data)
    );
  } catch {
    // ignore
  }
}

export async function refreshOverviewSnapshot(
  sessionUsersIO: SessionUsersReader
): Promise<OverviewData> {
  const data = await buildOverviewSnapshot(sessionUsersIO);
  await storeOverviewSnapshot(data);
  return data;
}

export function scheduleOverviewRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void runCoalescedOverviewRefresh();
  }, 400);
}

let sessionUsersIORef: SessionUsersReader | null = null;

export function setOverviewSessionUsersIO(io: SessionUsersReader): void {
  sessionUsersIORef = io;
}

async function runCoalescedOverviewRefresh(): Promise<void> {
  if (!sessionUsersIORef || refreshInFlight) return;
  refreshInFlight = true;
  try {
    await refreshOverviewSnapshot(sessionUsersIORef);
  } catch (err) {
    console.error("[overview] refresh failed:", err);
  } finally {
    refreshInFlight = false;
  }
}

export async function getOverviewForClient(
  sessionUsersIO: SessionUsersReader,
  options?: { forceRefresh?: boolean }
): Promise<OverviewData> {
  if (!options?.forceRefresh) {
    const cached = await getCachedOverview();
    if (cached) {
      if (!refreshInFlight) scheduleOverviewRefresh();
      return cached;
    }
  }
  return refreshOverviewSnapshot(sessionUsersIO);
}
