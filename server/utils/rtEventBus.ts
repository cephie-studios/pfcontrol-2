import { redisConnection } from '../db/connection.js';
import type { ClientFlight } from '../db/flights.js';

export type RtEventType =
  | 'flight.updated'
  | 'flight.added'
  | 'flight.deleted'
  | 'session.presence'
  | 'session.atis'
  | 'mention';

export interface RtFlightEventPayload {
  sessionId: string;
  flight: ClientFlight;
  networkKind?: 'pfatc' | 'advanced_atc' | null;
}

export interface RtFlightDeletedPayload {
  sessionId: string;
  flightId: string;
  networkKind?: 'pfatc' | 'advanced_atc' | null;
}

export interface RtSessionPresencePayload {
  sessionId: string;
}

export interface RtSessionAtisPayload {
  sessionId: string;
}

export interface RtMentionPayload {
  userId: string;
  mention: Record<string, unknown>;
}

type RtPayload =
  | RtFlightEventPayload
  | RtFlightDeletedPayload
  | RtSessionPresencePayload
  | RtSessionAtisPayload
  | RtMentionPayload;

export async function publishRtEvent(
  type: RtEventType,
  payload: RtPayload
): Promise<void> {
  const channel = `rt:${type}`;
  try {
    await redisConnection.publish(channel, JSON.stringify({ type, payload }));
  } catch (err) {
    console.error('[rtEventBus] publish failed:', type, err);
  }
}