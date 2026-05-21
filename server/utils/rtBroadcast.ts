import type { ClientFlight } from '../db/flights.js';
import { getNetworkKind } from './advancedNetworkSession.js';
import { publishRtEvent } from './rtEventBus.js';
import {
  broadcastFlightEvent,
  broadcastToArrivalSessions,
} from '../websockets/flightsWebsocket.js';
import { getActiveUsersForSession } from '../websockets/sessionUsersWebsocket.js';

export function isRealtimeDelegated(): boolean {
  return process.env.REALTIME_DELEGATED === 'true';
}

export async function broadcastFlightAdded(
  sessionId: string,
  flight: ClientFlight,
  networkKind?: ReturnType<typeof getNetworkKind>
): Promise<void> {
  await publishRtEvent('flight.added', {
    sessionId,
    flight,
    networkKind: networkKind ?? null,
  });
  if (!isRealtimeDelegated()) {
    const sanitized = sanitizeForBroadcast(flight);
    broadcastFlightEvent(sessionId, 'flightAdded', sanitized);
    await broadcastToArrivalSessions(sanitized, networkKind ?? null);
  }
}

export async function broadcastFlightUpdated(
  sessionId: string,
  flight: ClientFlight,
  networkKind?: ReturnType<typeof getNetworkKind>
): Promise<void> {
  await publishRtEvent('flight.updated', {
    sessionId,
    flight,
    networkKind: networkKind ?? null,
  });
  if (!isRealtimeDelegated()) {
    broadcastFlightEvent(sessionId, 'flightUpdated', flight);
    await broadcastToArrivalSessions(flight, networkKind ?? null);
  }
}

export async function broadcastFlightDeleted(
  sessionId: string,
  flightId: string,
  networkKind?: ReturnType<typeof getNetworkKind>
): Promise<void> {
  await publishRtEvent('flight.deleted', {
    sessionId,
    flightId,
    networkKind: networkKind ?? null,
  });
  if (!isRealtimeDelegated()) {
    broadcastFlightEvent(sessionId, 'flightDeleted', { flightId });
  }
}

/** Chat/global-chat mention bridge when session-users socket runs on Go. */
export function createSessionUsersBridgeForChat(): {
  getActiveUsersForSession: typeof getActiveUsersForSession;
  sendMentionToUser: (
    userId: string,
    mentionData: Record<string, unknown>
  ) => void;
} {
  return {
    getActiveUsersForSession,
    sendMentionToUser: (userId, mentionData) => {
      void publishRtEvent('mention', { userId, mention: mentionData });
    },
  };
}

function sanitizeForBroadcast(flight: ClientFlight): ClientFlight {
  const {
    acars_token: _a,
    user_id: _u,
    ip_address: _i,
    ...rest
  } = flight as ClientFlight & {
    acars_token?: string;
    user_id?: string;
    ip_address?: string;
  };
  return rest;
}