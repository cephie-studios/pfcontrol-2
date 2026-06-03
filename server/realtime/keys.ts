import { prefixKey } from "../utils/cacheTtl.js";

export const TTL = {
  USER_SESSIONS_SEC: 5 * 60,
  USER_BADGE_SEC: 15 * 60,
  SESSION_META_SEC: 24 * 60 * 60,
  SESSION_FLIGHTS_SEC: 120,
  OVERVIEW_SNAPSHOT_SEC: 5,
  ARRIVALS_SEC: 60,
  SESSIONS_BY_AIRPORT_SEC: 60,
  FLIGHT_SOURCE_SEC: 24 * 60 * 60,
  ATIS_DECRYPTED_SEC: 5 * 60,
  CHAT_RECENT_SEC: 30 * 60,
} as const;

export const keys = {
  userSessions: (userId: string) => prefixKey(`user:sessions:${userId}`),
  activeNetwork: (network: "pfatc" | "advanced_atc") =>
    prefixKey(`active:network:${network}`),
  sessionMeta: (sessionId: string) => prefixKey(`session:meta:${sessionId}`),
  sessionFlights: (sessionId: string) =>
    prefixKey(`flights:session:${sessionId}`),
  overviewSnapshot: () => prefixKey("overview:snapshot"),
  overviewVersion: () => prefixKey("overview:version"),
  arrivals: (network: "pfatc" | "advanced_atc", icao: string) =>
    prefixKey(`arrivals:${network}:${icao.toUpperCase()}`),
  sessionsByAirport: (network: "pfatc" | "advanced_atc", icao: string) =>
    prefixKey(`sessions:airport:${network}:${icao.toUpperCase()}`),
  flightSource: (flightId: string) => prefixKey(`flight:source:${flightId}`),
  atisDecrypted: (sessionId: string) => prefixKey(`session:atis:${sessionId}`),
  userBadge: (userId: string) => prefixKey(`users:badge:${userId}`),
  chatRecent: (sessionId: string) => prefixKey(`chat:recent:${sessionId}`),
  chatGlobal: (networkKind: "pfatc" | "aatc") =>
    prefixKey(`chat:global:${networkKind}`),
  activeUsers: (sessionId: string) => `activeUsers:${sessionId}`,
  activeUsersIndex: () => prefixKey("activeUsers:index"),
} as const;
