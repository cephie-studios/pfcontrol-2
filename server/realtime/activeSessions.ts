import { redisConnection } from "../db/connection.js";
import { getSessionById } from "../db/sessions.js";
import {
  getNetworkKind,
  isAdvancedNetworkSession,
  type NetworkKind,
} from "../utils/advancedNetworkSession.js";
import { keys, TTL } from "./keys.js";

export type SessionMeta = {
  sessionId: string;
  airportIcao: string;
  activeRunway: string | null;
  createdAt: string | null;
  createdBy: string;
  isPFATC: boolean;
  isAdvancedATC: boolean;
  hasAtis: boolean;
  networkKind: NetworkKind | null;
};

export async function setSessionMetaFromRow(session: {
  session_id: string;
  airport_icao: string;
  active_runway?: string | null;
  created_at?: Date | null;
  created_by: string;
  is_pfatc?: boolean | null;
  is_advanced_atc?: boolean | null;
  atis?: unknown;
}): Promise<SessionMeta | null> {
  if (!isAdvancedNetworkSession(session)) return null;

  const meta: SessionMeta = {
    sessionId: session.session_id,
    airportIcao: session.airport_icao,
    activeRunway: session.active_runway ?? null,
    createdAt: session.created_at
      ? new Date(session.created_at).toISOString()
      : null,
    createdBy: session.created_by,
    isPFATC: Boolean(session.is_pfatc),
    isAdvancedATC: Boolean(session.is_advanced_atc),
    hasAtis: Boolean(session.atis),
    networkKind: getNetworkKind(session),
  };

  try {
    await redisConnection.setex(
      keys.sessionMeta(session.session_id),
      TTL.SESSION_META_SEC,
      JSON.stringify(meta)
    );
  } catch {
    // ignore
  }
  return meta;
}

export async function refreshSessionMeta(
  sessionId: string
): Promise<SessionMeta | null> {
  const session = await getSessionById(sessionId);
  if (!session) return null;
  return setSessionMetaFromRow(session);
}

export async function getSessionMeta(
  sessionId: string
): Promise<SessionMeta | null> {
  try {
    const raw = await redisConnection.get(keys.sessionMeta(sessionId));
    if (raw) return JSON.parse(raw) as SessionMeta;
  } catch {
    // ignore
  }
  const session = await getSessionById(sessionId);
  if (!session) return null;
  return setSessionMetaFromRow(session);
}

export async function getSessionMetas(
  sessionIds: string[]
): Promise<Map<string, SessionMeta>> {
  const map = new Map<string, SessionMeta>();
  if (sessionIds.length === 0) return map;

  const cacheKeys = sessionIds.map((id) => keys.sessionMeta(id));
  let cached: (string | null)[] = [];
  try {
    cached = await redisConnection.mget(...cacheKeys);
  } catch {
    cached = [];
  }

  const misses: string[] = [];
  sessionIds.forEach((id, i) => {
    const raw = cached[i];
    if (raw) {
      try {
        map.set(id, JSON.parse(raw) as SessionMeta);
      } catch {
        misses.push(id);
      }
    } else {
      misses.push(id);
    }
  });

  await Promise.all(
    misses.map(async (id) => {
      const meta = await refreshSessionMeta(id);
      if (meta) map.set(id, meta);
    })
  );

  return map;
}

async function trackActiveUsersKey(
  sessionId: string,
  add: boolean
): Promise<void> {
  try {
    if (add) {
      await redisConnection.sadd(keys.activeUsersIndex(), sessionId);
    } else {
      const count = await redisConnection.hlen(keys.activeUsers(sessionId));
      if (count === 0) {
        await redisConnection.srem(keys.activeUsersIndex(), sessionId);
      }
    }
  } catch {
    // ignore
  }
}

export async function registerActiveSession(sessionId: string): Promise<void> {
  const meta = await refreshSessionMeta(sessionId);
  if (!meta?.networkKind) return;
  try {
    await redisConnection.sadd(keys.activeNetwork(meta.networkKind), sessionId);
    await trackActiveUsersKey(sessionId, true);
  } catch {
    // ignore
  }
}

export async function unregisterActiveSession(
  sessionId: string
): Promise<void> {
  const meta = await getSessionMeta(sessionId);
  if (meta?.networkKind) {
    try {
      await redisConnection.srem(
        keys.activeNetwork(meta.networkKind),
        sessionId
      );
    } catch {
      // ignore
    }
  } else {
    try {
      await redisConnection.srem(keys.activeNetwork("pfatc"), sessionId);
      await redisConnection.srem(keys.activeNetwork("advanced_atc"), sessionId);
    } catch {
      // ignore
    }
  }
  await trackActiveUsersKey(sessionId, false);
}

export async function getActiveNetworkSessionIds(): Promise<string[]> {
  try {
    const [pfatc, aatc] = await Promise.all([
      redisConnection.smembers(keys.activeNetwork("pfatc")),
      redisConnection.smembers(keys.activeNetwork("advanced_atc")),
    ]);
    return [...new Set([...pfatc, ...aatc])];
  } catch {
    return [];
  }
}

/** Rebuild network sets from existing activeUsers:* keys (startup / periodic). */
export async function rebuildActiveNetworkSetsFromRedis(): Promise<void> {
  try {
    await redisConnection.del(
      keys.activeNetwork("pfatc"),
      keys.activeNetwork("advanced_atc")
    );

    const sessionIds = await redisConnection.smembers(keys.activeUsersIndex());
    if (sessionIds.length > 0) {
      for (const sessionId of sessionIds) {
        const count = await redisConnection.hlen(keys.activeUsers(sessionId));
        if (count > 0) {
          await registerActiveSession(sessionId);
        } else {
          await redisConnection.srem(keys.activeUsersIndex(), sessionId);
        }
      }
      return;
    }

    const activeKeys = await redisConnection.keys("activeUsers:*");
    for (const key of activeKeys) {
      const sessionId = key.replace("activeUsers:", "");
      const count = await redisConnection.hlen(key);
      if (count > 0) {
        await redisConnection.sadd(keys.activeUsersIndex(), sessionId);
        await registerActiveSession(sessionId);
      }
    }
  } catch (err) {
    console.error("[activeSessions] rebuild failed:", err);
  }
}

export async function onSessionUsersChanged(
  sessionId: string,
  userCount: number
): Promise<void> {
  if (userCount > 0) {
    await registerActiveSession(sessionId);
  } else {
    await unregisterActiveSession(sessionId);
  }
}