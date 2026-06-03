export type HttpMethod = 'GET' | 'POST' | 'PUT';

export interface DeveloperExtRouteParamDoc {
  name: string;
  description: string;
  example?: string;
}

export interface DeveloperExtRouteQueryDoc {
  name: string;
  required: boolean;
  description: string;
  example?: string;
}

type RoutePattern =
  | { kind: 'exact'; path: string }
  | { kind: 'regex'; regex: RegExp; pathTemplate: string };

export interface DeveloperExtRouteDefinition {
  scopeId: string;
  method: HttpMethod;
  pattern: RoutePattern;
  responseSummary: string;
  pathParams?: DeveloperExtRouteParamDoc[];
  queryParams?: DeveloperExtRouteQueryDoc[];
  requestBodySummary?: string;
  requestBodyExampleJson?: string;
}

export const DEVELOPER_EXT_ROUTES: readonly DeveloperExtRouteDefinition[] = [
  {
    scopeId: 'ratings.controller_stats',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/ratings\/controllers\/[^/]+\/stats$/i,
      pathTemplate: '/ratings/controllers/{controllerId}/stats',
    },
    responseSummary:
      'Aggregate rating count and average for a VATSIM controller id (no pilot identifiers).',
    pathParams: [
      {
        name: 'controllerId',
        description: 'VATSIM controller identifier.',
        example: '1234567',
      },
    ],
  },
  {
    scopeId: 'notifications.read',
    method: 'GET',
    pattern: { kind: 'exact', path: '/notifications/active' },
    responseSummary:
      'Public active announcements (same fields as web homepage feed; no admin-only data).',
  },
  {
    scopeId: 'flight_logs.read',
    method: 'GET',
    pattern: { kind: 'exact', path: '/flight-logs' },
    responseSummary:
      'Sanitized flight change audit entries for sessions you own (id, timestamps, action, session/flight ids only; no IP, no old/new payload text).',
    queryParams: [
      {
        name: 'sessionId',
        required: false,
        description: 'Filter to one owned session.',
        example: 'sess_abc123',
      },
      {
        name: 'page',
        required: false,
        description: 'Page number (default 1).',
        example: '1',
      },
      {
        name: 'limit',
        required: false,
        description: 'Page size (max 100, default 50).',
        example: '50',
      },
    ],
  },
  {
    scopeId: 'sessions.network_pfatc',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/sessions\/network\/pfatc\/[^/]+$/i,
      pathTemplate: '/sessions/network/pfatc/{sessionId}',
    },
    responseSummary:
      'One PFATC network session (sanitized): airport, runway, counts, controller public profile. Not limited to sessions you own.',
    pathParams: [
      {
        name: 'sessionId',
        description: 'Session identifier.',
        example: 'sess_abc123',
      },
    ],
  },
  {
    scopeId: 'sessions.network_pfatc',
    method: 'GET',
    pattern: { kind: 'exact', path: '/sessions/network/pfatc' },
    responseSummary:
      'JSON array of PFATC network sessions (sanitized; no access_id). Optional airport (ICAO), page, limit.',
    queryParams: [
      {
        name: 'airport',
        required: false,
        description: 'Filter to one airport ICAO (4 letters).',
        example: 'EGLL',
      },
      {
        name: 'page',
        required: false,
        description: 'Page number (default 1).',
        example: '1',
      },
      {
        name: 'limit',
        required: false,
        description: 'Page size (max 100, default 50).',
        example: '50',
      },
    ],
  },
  {
    scopeId: 'sessions.network_aatc',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/sessions\/network\/aatc\/[^/]+$/i,
      pathTemplate: '/sessions/network/aatc/{sessionId}',
    },
    responseSummary:
      'One Advanced ATC (AATC) network session (sanitized). Not limited to sessions you own.',
    pathParams: [
      {
        name: 'sessionId',
        description: 'Session identifier.',
        example: 'sess_abc123',
      },
    ],
  },
  {
    scopeId: 'sessions.network_aatc',
    method: 'GET',
    pattern: { kind: 'exact', path: '/sessions/network/aatc' },
    responseSummary:
      'JSON array of Advanced ATC (AATC) network sessions (sanitized; no access_id). Optional airport, page, limit.',
    queryParams: [
      {
        name: 'airport',
        required: false,
        description: 'Filter to one airport ICAO (4 letters).',
        example: 'EGLL',
      },
      {
        name: 'page',
        required: false,
        description: 'Page number (default 1).',
        example: '1',
      },
      {
        name: 'limit',
        required: false,
        description: 'Page size (max 100, default 50).',
        example: '50',
      },
    ],
  },
  {
    scopeId: 'flights.read',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/sessions\/[^/]+\/flights\/[^/]+$/i,
      pathTemplate: '/sessions/{sessionId}/flights/{flightId}',
    },
    responseSummary:
      'Single flight JSON (no IP, ACARS token, or pilot Discord linkage).',
    pathParams: [
      {
        name: 'sessionId',
        description: 'Session identifier.',
        example: 'sess_abc123',
      },
      {
        name: 'flightId',
        description: 'Flight UUID.',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    ],
  },
  {
    scopeId: 'flights.update',
    method: 'PUT',
    pattern: {
      kind: 'regex',
      regex: /^\/sessions\/[^/]+\/flights\/[^/]+$/i,
      pathTemplate: '/sessions/{sessionId}/flights/{flightId}',
    },
    responseSummary:
      'Updated flight JSON (sanitized). Only allowed for sessions created with this same API key.',
    pathParams: [
      {
        name: 'sessionId',
        description: 'Session identifier.',
        example: 'sess_abc123',
      },
      {
        name: 'flightId',
        description: 'Flight UUID.',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    ],
    requestBodySummary:
      'Partial flight fields (same subset as web UI): callsign, aircraft, departure, arrival, route, sid, star, runway, cruisingFL, clearedFL, squawk, wtc, status, remark, clearance, stand, gate, hidden, etc.',
    requestBodyExampleJson: JSON.stringify({
      status: 'ACTIVE',
      runway: '27L',
      squawk: '1234',
    }),
  },
  {
    scopeId: 'flights.list',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/sessions\/[^/]+\/flights$/i,
      pathTemplate: '/sessions/{sessionId}/flights',
    },
    responseSummary:
      'JSON array of flights (sanitized; no IPs or ACARS tokens).',
    pathParams: [
      {
        name: 'sessionId',
        description: 'Session you own (created_by matches key owner).',
        example: 'sess_abc123',
      },
    ],
  },
  {
    scopeId: 'flights.create',
    method: 'POST',
    pattern: {
      kind: 'regex',
      regex: /^\/sessions\/[^/]+\/flights$/i,
      pathTemplate: '/sessions/{sessionId}/flights',
    },
    responseSummary:
      'Creates a flight; returns sanitized flight (no ACARS token in response).',
    pathParams: [
      {
        name: 'sessionId',
        description: 'Session you own.',
        example: 'sess_abc123',
      },
    ],
    requestBodySummary:
      'Flight fields (same as web submit): callsign, aircraft, flight_type, departure, arrival, route, etc.',
    requestBodyExampleJson: JSON.stringify({
      callsign: 'BAW123',
      aircraft: 'A320',
      flight_type: 'IFR',
      departure: 'EGLL',
      arrival: 'LFPG',
    }),
  },
  {
    scopeId: 'sessions.read',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/sessions\/[^/]+$/i,
      pathTemplate: '/sessions/{sessionId}',
    },
    responseSummary:
      'Session metadata without access_id (join codes are not exposed via developer API).',
    pathParams: [
      {
        name: 'sessionId',
        description: 'Session identifier.',
        example: 'sess_abc123',
      },
    ],
  },
  {
    scopeId: 'sessions.list',
    method: 'GET',
    pattern: { kind: 'exact', path: '/sessions' },
    responseSummary:
      'JSON array of sessions you created (no access_id). Includes apiManaged when the session was created via the developer API.',
  },
  {
    scopeId: 'sessions.create',
    method: 'POST',
    pattern: { kind: 'exact', path: '/sessions' },
    responseSummary:
      'Creates a session tied to your user and this API key (API-managed). Returns session id and metadata without access_id.',
    requestBodySummary:
      'airportIcao (required), optional isPFATC, isAdvancedATC (mutually exclusive), activeRunway.',
    requestBodyExampleJson: JSON.stringify({
      airportIcao: 'EGLL',
      isPFATC: false,
      isAdvancedATC: false,
      activeRunway: '27L',
    }),
  },
  {
    scopeId: 'data.airports',
    method: 'GET',
    pattern: { kind: 'exact', path: '/data/airports' },
    responseSummary: 'JSON array of airport objects (static dataset).',
  },
  {
    scopeId: 'data.aircrafts',
    method: 'GET',
    pattern: { kind: 'exact', path: '/data/aircrafts' },
    responseSummary: 'JSON array of aircraft reference records.',
  },
  {
    scopeId: 'data.airlines',
    method: 'GET',
    pattern: { kind: 'exact', path: '/data/airlines' },
    responseSummary: 'JSON array of airline reference records.',
  },
  {
    scopeId: 'data.frequencies',
    method: 'GET',
    pattern: { kind: 'exact', path: '/data/frequencies' },
    responseSummary: 'JSON array of per-airport frequency summaries.',
  },
  {
    scopeId: 'data.backgrounds',
    method: 'GET',
    pattern: { kind: 'exact', path: '/data/backgrounds' },
    responseSummary:
      'JSON array of background image metadata (filename, path, extension).',
  },
  {
    scopeId: 'data.find_route',
    method: 'GET',
    pattern: { kind: 'exact', path: '/data/findRoute' },
    responseSummary: 'JSON object with path (waypoint ids), distance, success.',
    queryParams: [
      {
        name: 'from',
        required: true,
        description: 'Start waypoint identifier.',
        example: 'EGLL',
      },
      {
        name: 'to',
        required: true,
        description: 'End waypoint identifier.',
        example: 'LFPG',
      },
    ],
  },
  {
    scopeId: 'data.airport_runways',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/data\/airports\/[^/]+\/runways$/i,
      pathTemplate: '/data/airports/{icao}/runways',
    },
    responseSummary: 'JSON array of runway strings/objects for the airport.',
    pathParams: [
      {
        name: 'icao',
        description: 'Airport ICAO code (case-insensitive in URL).',
        example: 'EGLL',
      },
    ],
  },
  {
    scopeId: 'data.airport_sids',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/data\/airports\/[^/]+\/sids$/i,
      pathTemplate: '/data/airports/{icao}/sids',
    },
    responseSummary: 'JSON array of SID definitions for the airport.',
    pathParams: [
      {
        name: 'icao',
        description: 'Airport ICAO code.',
        example: 'EGLL',
      },
    ],
  },
  {
    scopeId: 'data.airport_stars',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/data\/airports\/[^/]+\/stars$/i,
      pathTemplate: '/data/airports/{icao}/stars',
    },
    responseSummary: 'JSON array of STAR definitions for the airport.',
    pathParams: [
      {
        name: 'icao',
        description: 'Airport ICAO code.',
        example: 'EGLL',
      },
    ],
  },
  {
    scopeId: 'data.airport_status',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/data\/airports\/[^/]+\/status$/i,
      pathTemplate: '/data/airports/{icao}/status',
    },
    responseSummary:
      'JSON with active PFATC/Advanced session summary, controller, runway, flight count, METAR when available.',
    pathParams: [
      {
        name: 'icao',
        description: 'Airport ICAO code.',
        example: 'EGLL',
      },
    ],
  },
];

export function pathTemplateForRoute(r: DeveloperExtRouteDefinition): string {
  if (r.pattern.kind === 'exact') return r.pattern.path;
  return r.pattern.pathTemplate;
}

export function matchExtDeveloperRoute(
  method: string,
  pathNoQuery: string
): string | null {
  const p = pathNoQuery.split('?')[0];
  for (const r of DEVELOPER_EXT_ROUTES) {
    if (r.method !== method) continue;
    if (r.pattern.kind === 'exact' && r.pattern.path === p) return r.scopeId;
    if (r.pattern.kind === 'regex' && r.pattern.regex.test(p)) return r.scopeId;
  }
  return null;
}

/** @deprecated Use matchExtDeveloperRoute; kept for internal naming continuity. */
export const matchExtDataRoute = matchExtDeveloperRoute;
