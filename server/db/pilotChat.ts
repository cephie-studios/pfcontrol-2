import { sql } from 'kysely';
import { mainDb } from './connection.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { validateFlightId, validateSessionId } from '../utils/validation.js';
import {
  containsHateSpeech,
  containsProfanity,
  getHateSpeechReason,
} from '../utils/hateSpeechFilter.js';

export const PILOT_CHAT_REPORT_PREFIX = 'pilot-chat:';
export const BROADCAST_FLIGHT_ID = '*';
const DEFAULT_AVATAR = '/assets/app/default/avatar.webp';

export interface PilotChatMessage {
  id: number;
  flightId: string;
  sender: 'pilot' | 'atc';
  userId: string;
  username: string;
  avatar: string;
  station: string | null;
  callsign: string | null;
  message: string;
  sentAt: string;
}

type PilotChatRow = {
  id: number;
  flight_id: string;
  sender: 'pilot' | 'atc';
  user_id: string;
  username?: string;
  avatar?: string;
  station?: string | null;
  callsign?: string | null;
  message: string;
  sent_at?: Date;
};

function toClient(row: PilotChatRow, plain?: string): PilotChatMessage {
  let message = plain ?? '';
  if (plain === undefined) {
    try {
      message = decrypt(JSON.parse(row.message)) ?? '';
    } catch {
      message = '';
    }
  }
  return {
    id: Number(row.id),
    flightId: row.flight_id,
    sender: row.sender,
    userId: row.user_id,
    username: row.username ?? '',
    avatar: row.avatar ?? '',
    station: row.station ?? null,
    callsign: row.callsign ?? null,
    message,
    sentAt: (row.sent_at ?? new Date()).toISOString(),
  };
}

export async function getAcarsFlight(
  sessionId: string,
  flightId: string,
  acarsToken: string
) {
  const flight = await mainDb
    .selectFrom('flights')
    .select(['id', 'callsign', 'acars_token'])
    .where('session_id', '=', validateSessionId(sessionId))
    .where('id', '=', validateFlightId(flightId))
    .executeTakeFirst();
  if (!flight || !flight.acars_token || flight.acars_token !== acarsToken) {
    return null;
  }
  return { id: String(flight.id), callsign: flight.callsign ?? null };
}

export async function getSessionFlight(sessionId: string, flightId: string) {
  const flight = await mainDb
    .selectFrom('flights')
    .select(['id', 'callsign'])
    .where('session_id', '=', validateSessionId(sessionId))
    .where('id', '=', validateFlightId(flightId))
    .executeTakeFirst();
  return flight
    ? { id: String(flight.id), callsign: flight.callsign ?? null }
    : null;
}

export async function getAcarsFlights(sessionId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await mainDb
    .selectFrom('flights')
    .select(['id', 'callsign', 'departure', 'arrival'])
    .where('session_id', '=', validateSessionId(sessionId))
    .where('acars_token', 'is not', null)
    .where('created_at', '>=', since)
    .orderBy('created_at', 'desc')
    .limit(200)
    .execute();
  return rows.map((row) => ({
    id: String(row.id),
    callsign: row.callsign ?? null,
    departure: row.departure ?? null,
    arrival: row.arrival ?? null,
  }));
}

export async function getPilotChatMessages(
  sessionId: string,
  flightId?: string,
  limit = 300
) {
  let query = mainDb
    .selectFrom('pilot_chat')
    .selectAll()
    .where('session_id', '=', validateSessionId(sessionId))
    .where('blocked', '=', false);
  if (flightId) {
    query = query.where('flight_id', 'in', [flightId, BROADCAST_FLIGHT_ID]);
  }
  const rows = await query.orderBy('sent_at', 'desc').limit(limit).execute();
  return rows.reverse().map((row) => toClient(row));
}

export type AddPilotChatResult =
  | { ok: true; message: PilotChatMessage }
  | { ok: false; reason: string };

export async function addPilotChatMessage(input: {
  sessionId: string;
  flightId: string;
  sender: 'pilot' | 'atc';
  userId: string;
  username: string;
  avatar: string | null;
  station: string | null;
  callsign: string | null;
  message: string;
}): Promise<AddPilotChatResult> {
  const sessionId = validateSessionId(input.sessionId);
  const encrypted = encrypt(input.message);
  if (!encrypted) throw new Error('Encryption failed for pilot chat message.');

  const hateSpeech = containsHateSpeech(input.message);
  const blocked = hateSpeech || containsProfanity(input.message);

  const row = await mainDb
    .insertInto('pilot_chat')
    .values({
      id: sql`DEFAULT`,
      session_id: sessionId,
      flight_id: input.flightId,
      sender: input.sender,
      user_id: input.userId,
      username: input.username,
      avatar: input.avatar ?? '',
      station: input.station,
      callsign: input.callsign,
      message: JSON.stringify(encrypted),
      blocked,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  if (hateSpeech) {
    const reason = getHateSpeechReason(input.message);
    await mainDb
      .insertInto('chat_report')
      .values({
        id: sql`DEFAULT`,
        session_id: `${PILOT_CHAT_REPORT_PREFIX}${sessionId}`,
        message_id: Number(row.id),
        reporter_user_id: 'automod',
        reporter_username: 'Automod',
        reported_user_id: input.userId,
        reported_username: input.username,
        reported_avatar: input.avatar || DEFAULT_AVATAR,
        message: input.message,
        reason: `${reason} (automod)`,
        reporter_avatar: '/assets/images/automod.webp',
      })
      .execute();
    return { ok: false, reason: 'Message blocked by automod' };
  }
  if (blocked) {
    return { ok: false, reason: 'Message contains inappropriate language' };
  }

  return { ok: true, message: toClient(row, input.message) };
}

export async function reportPilotChatMessage(input: {
  sessionId: string;
  messageId: number;
  reporter: { userId: string; username: string; avatar: string | null };
  reason: string;
  allowedSender: 'pilot' | 'atc';
  flightId?: string;
}) {
  const sessionId = validateSessionId(input.sessionId);
  let query = mainDb
    .selectFrom('pilot_chat')
    .selectAll()
    .where('session_id', '=', sessionId)
    .where('id', '=', input.messageId)
    .where('sender', '=', input.allowedSender);
  if (input.flightId) {
    query = query.where('flight_id', 'in', [
      input.flightId,
      BROADCAST_FLIGHT_ID,
    ]);
  }
  const row = await query.executeTakeFirst();
  if (!row) throw new Error('Message not found');

  const message = toClient(row);
  await mainDb
    .insertInto('chat_report')
    .values({
      id: sql`DEFAULT`,
      session_id: `${PILOT_CHAT_REPORT_PREFIX}${sessionId}`,
      message_id: message.id,
      reporter_user_id: input.reporter.userId,
      reporter_username: input.reporter.username,
      reporter_avatar: input.reporter.avatar || DEFAULT_AVATAR,
      reported_user_id: message.userId,
      reported_username: message.username,
      reported_avatar: message.avatar || DEFAULT_AVATAR,
      message: message.message,
      reason: input.reason,
    })
    .execute();
}

export async function deletePilotChatMessage(input: {
  sessionId: string;
  messageId: number;
  userId: string;
  sender: 'pilot' | 'atc';
}) {
  const row = await mainDb
    .deleteFrom('pilot_chat')
    .where('session_id', '=', validateSessionId(input.sessionId))
    .where('id', '=', input.messageId)
    .where('user_id', '=', input.userId)
    .where('sender', '=', input.sender)
    .returning(['flight_id'])
    .executeTakeFirst();
  return row ? row.flight_id : null;
}
