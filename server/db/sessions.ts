import { sql } from "kysely";
import { mainDb } from "./connection.js";
import { addFlight } from "./flights.js";
import { validateSessionId } from "../utils/validation.js";
import { encrypt } from "../utils/encryption.js";
import {
  assertExclusiveSessionNetworkFlags,
  ExclusiveSessionNetworkFlagsError,
  isPostgresCheckViolation,
} from "../utils/sessionNetworkFlags.js";

interface CreateSessionParams {
  sessionId: string;
  accessId: string;
  activeRunway?: string;
  airportIcao: string;
  createdBy: string;
  isPFATC?: boolean;
  isAdvancedATC?: boolean;
  developerApiKeyId?: string | null;
}

export async function createSession({
  sessionId,
  accessId,
  activeRunway,
  airportIcao,
  createdBy,
  isPFATC,
  isAdvancedATC,
  isTutorial,
  developerApiKeyId,
}: CreateSessionParams & { isTutorial?: boolean }) {
  const validSessionId = validateSessionId(sessionId);

  const encryptedAtis = encrypt({
    letter: "A",
    text: "",
    timestamp: new Date().toISOString(),
  });

  const isPfatc = Boolean(isPFATC);
  const isAdvancedAtc = Boolean(isAdvancedATC);
  assertExclusiveSessionNetworkFlags(isPfatc, isAdvancedAtc);

  try {
    const baseValues = {
      session_id: validSessionId,
      access_id: accessId,
      active_runway: activeRunway,
      airport_icao: airportIcao.toUpperCase(),
      created_by: createdBy,
      is_pfatc: isPfatc,
      is_advanced_atc: isAdvancedAtc,
      atis: JSON.stringify(encryptedAtis),
      ...(developerApiKeyId ? { developer_api_key_id: developerApiKeyId } : {}),
    };
    await mainDb.insertInto("sessions").values(baseValues).execute();
  } catch (e) {
    if (isPostgresCheckViolation(e)) {
      throw new ExclusiveSessionNetworkFlagsError();
    }
    throw e;
  }

  if (isTutorial) {
    await addFlight(sessionId, {
      callsign: "DLH123",
      aircraft: "A320",
      flight_type: "IFR",
      departure: airportIcao,
      arrival: "EGKK",
      stand: "EXAMPLE",
      runway: activeRunway || "",
      sid: "RADAR VECTORS",
      cruisingFL: 340,
      clearedFL: 140,
      squawk: "1234",
      wtc: "M",
      status: "PENDING",
      remark: "Example",
      hidden: false,
    });
  }
}

export async function getSessionById(sessionId: string) {
  return (
    (await mainDb
      .selectFrom("sessions")
      .selectAll()
      .where("session_id", "=", sessionId)
      .executeTakeFirst()) || null
  );
}

export async function getSessionsByUser(userId: string) {
  return await mainDb
    .selectFrom("sessions")
    .select([
      "session_id",
      "access_id",
      "active_runway",
      "airport_icao",
      "created_at",
      "created_by",
      "is_pfatc",
      "is_advanced_atc",
      "custom_name",
      "refreshed_at",
    ])
    .where("created_by", "=", userId)
    .orderBy("created_at", "desc")
    .execute();
}

export async function listDeveloperSessionSummariesForUser(userId: string) {
  return mainDb
    .selectFrom("sessions")
    .select([
      "session_id",
      "active_runway",
      "airport_icao",
      "created_at",
      "created_by",
      "is_pfatc",
      "is_advanced_atc",
      "custom_name",
      "refreshed_at",
      "developer_api_key_id",
    ])
    .where("created_by", "=", userId)
    .orderBy("created_at", "desc")
    .execute();
}

export async function getSessionsByUserDetailed(userId: string) {
  return await mainDb
    .selectFrom("sessions")
    .selectAll()
    .where("created_by", "=", userId)
    .orderBy("created_at", "desc")
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
    is_advanced_atc: boolean;
  }>,
) {
  const patch = { ...updates };

  if (patch.is_pfatc !== undefined || patch.is_advanced_atc !== undefined) {
    const current = await getSessionById(sessionId);
    if (!current) {
      return undefined;
    }

    const nextP =
      patch.is_pfatc !== undefined ? Boolean(patch.is_pfatc) : Boolean(current.is_pfatc);
    const nextA =
      patch.is_advanced_atc !== undefined
        ? Boolean(patch.is_advanced_atc)
        : Boolean(current.is_advanced_atc);

    let outP = nextP;
    let outA = nextA;
    if (outP && outA) {
      if (patch.is_pfatc === true && patch.is_advanced_atc !== true) {
        outA = false;
      } else if (patch.is_advanced_atc === true && patch.is_pfatc !== true) {
        outP = false;
      } else {
        throw new ExclusiveSessionNetworkFlagsError();
      }
    }

    assertExclusiveSessionNetworkFlags(outP, outA);
    patch.is_pfatc = outP;
    patch.is_advanced_atc = outA;
  }

  try {
    return await mainDb
      .updateTable("sessions")
      .set({
        ...patch,
        airport_icao: patch.airport_icao?.toUpperCase(),
        refreshed_at: patch.refreshed_at ? new Date(patch.refreshed_at) : undefined,
      })
      .where("session_id", "=", sessionId)
      .returningAll()
      .executeTakeFirst();
  } catch (e) {
    if (isPostgresCheckViolation(e)) {
      throw new ExclusiveSessionNetworkFlagsError();
    }
    throw e;
  }
}

export { ExclusiveSessionNetworkFlagsError } from "../utils/sessionNetworkFlags.js";

export async function updateSessionName(sessionId: string, customName: string) {
  return await mainDb
    .updateTable("sessions")
    .set({ custom_name: customName })
    .where("session_id", "=", sessionId)
    .returningAll()
    .executeTakeFirst();
}

export async function deleteSession(sessionId: string) {
  const validSessionId = validateSessionId(sessionId);

  await mainDb.deleteFrom("flights").where("session_id", "=", validSessionId).execute();

  await mainDb.deleteFrom("session_chat").where("session_id", "=", validSessionId).execute();

  await mainDb.deleteFrom("sessions").where("session_id", "=", validSessionId).execute();
}

export async function getAllSessions() {
  return await mainDb.selectFrom("sessions").selectAll().orderBy("created_at", "desc").execute();
}

export async function getSessionsByAirportAndNetwork(
  airportIcao: string,
  networkKind: "pfatc" | "advanced_atc",
) {
  const query = mainDb
    .selectFrom("sessions")
    .selectAll()
    .where("airport_icao", "=", airportIcao.toUpperCase());

  if (networkKind === "pfatc") {
    return query.where("is_pfatc", "=", true).execute();
  } else {
    return query.where("is_advanced_atc", "=", true).execute();
  }
}

export type DeveloperPublicNetworkKind = "pfatc" | "aatc";

export type PublicNetworkSessionDeveloperRow = {
  session_id: string;
  airport_icao: string;
  active_runway?: string | null;
  custom_name?: string | null;
  created_at?: Date | null;
  refreshed_at?: Date | null;
  created_by: string;
  flight_count: number;
  username: string;
  avatar?: string | null;
};

export async function listPublicNetworkSessionsForDeveloperApi(opts: {
  kind: DeveloperPublicNetworkKind;
  airportIcao?: string | null;
  limit: number;
  offset: number;
}): Promise<PublicNetworkSessionDeveloperRow[]> {
  const limit = Math.min(100, Math.max(1, opts.limit));
  const offset = Math.max(0, opts.offset);
  const icao =
    opts.airportIcao && typeof opts.airportIcao === "string"
      ? opts.airportIcao.trim().toUpperCase()
      : null;

  let q = mainDb
    .selectFrom("sessions as s")
    .innerJoin("users as u", "u.id", "s.created_by")
    .select([
      "s.session_id",
      "s.airport_icao",
      "s.active_runway",
      "s.custom_name",
      "s.created_at",
      "s.refreshed_at",
      "s.created_by",
      sql<number>`coalesce((select count(*)::int from flights f where f.session_id = s.session_id), 0)`.as(
        "flight_count",
      ),
      "u.username",
      "u.avatar",
    ]);
  if (opts.kind === "pfatc") {
    q = q.where("s.is_pfatc", "=", true);
  } else {
    q = q.where("s.is_advanced_atc", "=", true);
  }

  if (icao && /^[A-Z]{4}$/.test(icao)) {
    q = q.where("s.airport_icao", "=", icao);
  }

  return await q
    .orderBy(sql`s.refreshed_at desc nulls last`)
    .orderBy("s.created_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();
}

export async function getPublicNetworkSessionForDeveloperApi(
  sessionId: string,
  kind: DeveloperPublicNetworkKind,
): Promise<PublicNetworkSessionDeveloperRow | null> {
  const valid = validateSessionId(sessionId);
  let q = mainDb
    .selectFrom("sessions as s")
    .innerJoin("users as u", "u.id", "s.created_by")
    .select([
      "s.session_id",
      "s.airport_icao",
      "s.active_runway",
      "s.custom_name",
      "s.created_at",
      "s.refreshed_at",
      "s.created_by",
      sql<number>`coalesce((select count(*)::int from flights f where f.session_id = s.session_id), 0)`.as(
        "flight_count",
      ),
      "u.username",
      "u.avatar",
    ])
    .where("s.session_id", "=", valid);
  if (kind === "pfatc") {
    q = q.where("s.is_pfatc", "=", true);
  } else {
    q = q.where("s.is_advanced_atc", "=", true);
  }

  const row = await q.executeTakeFirst();
  return row ?? null;
}