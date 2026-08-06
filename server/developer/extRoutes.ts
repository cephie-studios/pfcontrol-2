export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

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
  minVersion?: 1 | 2;
}

export const SELF_INFO_SCOPE_ID = 'self.read';

export const DEVELOPER_EXT_ROUTES: readonly DeveloperExtRouteDefinition[] = [
  {
    scopeId: SELF_INFO_SCOPE_ID,
    method: 'GET',
    pattern: { kind: 'exact', path: '/me' },
    responseSummary:
      'Information about the calling API key itself: id, name, key prefix, owning user id, granted scopes (with labels/descriptions), effective rate limit, and which API version this request used. Always available regardless of scopes.',
  },
  {
    scopeId: 'ratings.controller_stats',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/ratings\/controllers\/[^/]+\/stats$/i,
      pathTemplate: '/ratings/controllers/{controllerId}/stats',
    },
    responseSummary:
      'Aggregate rating count and average for a controller, keyed by their app user id. 404 if controllerId does not match a real user; averageRating/ratingCount are 0 for a real user with no ratings yet.',
    pathParams: [
      {
        name: 'controllerId',
        description:
          "The controller's user id",
        example: '123456789012345678',
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
        example: 'f0a25bbc',
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
        example: 'f0a25bbc',
      },
    ],
  },
  {
    scopeId: 'sessions.network_pfatc',
    method: 'GET',
    pattern: { kind: 'exact', path: '/sessions/network/pfatc' },
    responseSummary:
      'JSON array of PFATC network sessions (sanitized). Optional airport (ICAO), page, limit.',
    queryParams: [
      {
        name: 'airport',
        required: false,
        description: 'Filter to one airport ICAO (4 letters).',
        example: 'EGKK',
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
    scopeId: 'sessions.network_overview',
    method: 'GET',
    pattern: { kind: 'exact', path: '/sessions/network/overview' },
    responseSummary:
      'Every PFATC session network-wide that was created in the last 4 hours or has had flight activity in the last 4 hours. A live connected controller is not required. Each session includes nested flights updated in the last 30 minutes (sanitized), connected-controller list (if any), and decoded ATIS. Also includes totalActiveSessions, totalFlights, arrivalsByAirport (flights grouped by arrival ICAO across every session), and lastUpdated. Not limited to sessions you own.',
    minVersion: 2,
  },
  {
    scopeId: 'sessions.network_overview',
    method: 'GET',
    pattern: { kind: 'exact', path: '/sessions/network/flights' },
    responseSummary:
      'Flat JSON array of every flight updated in the last 30 minutes, across every PFATC session network-wide that was created or flight-active in the last 4 hours. Each flight is annotated with sessionId and departureAirport. Not limited to sessions you own.',
    minVersion: 2,
  },
  {
    scopeId: 'flights.network_manage',
    method: 'PUT',
    pattern: { kind: 'exact', path: '/sessions/network/flights' },
    responseSummary:
      'Batch-updates flights on any PFATC session network-wide. Is not limited to sessions created with this API key. Returns { results: [...] }, one entry per requested update in the same order, each either { sessionId, flightId, ok: true, flight } or { sessionId, flightId, ok: false, error }. A failure on one item does not affect the others. Max 25 updates per request.',
    requestBodySummary:
      'JSON object: { "updates": [{ "sessionId", "flightId", "fields": { ... } }, ...] }, max 25 updates. fields uses the same camelCase names the API returns, restricted to: callsign, remark, squawk, cruisingFL, clearedFL, runway (see GET /data/airports/{icao}/runways — rejected for that item if not a runway at the flight\'s current departure airport), stand, gate, sid, star (see GET /data/airports/{icao}/sids and /stars), reqAt (ISO timestamp or null), reqPhase (one of C, P, T, G, or null), clearance (boolean) — the same set an event controller can edit from the live Overview page. Any other field is silently ignored. This action is logged — see GET /flight-logs.',
    requestBodyExampleJson: JSON.stringify({
      updates: [
        {
          sessionId: 'f0a25bbc',
          flightId: 'da8dd215',
          fields: { runway: '26L', clearance: true },
        },
        {
          sessionId: 'ccf3ad9f',
          flightId: 'cdd08ab1',
          fields: { squawk: '2265' },
        },
      ],
    }),
    minVersion: 2,
  },
  // AATC disabled — sessions.network_aatc routes commented out
  // {
  //   scopeId: 'sessions.network_aatc',
  //   method: 'GET',
  //   pattern: { kind: 'regex', regex: /^\/sessions\/network\/aatc\/[^/]+$/i, pathTemplate: '/sessions/network/aatc/{sessionId}' },
  //   responseSummary: 'One Advanced ATC (AATC) network session.',
  //   pathParams: [{ name: 'sessionId', description: 'Session identifier.', example: 'f0a25bac' }],
  // },
  // {
  //   scopeId: 'sessions.network_aatc',
  //   method: 'GET',
  //   pattern: { kind: 'exact', path: '/sessions/network/aatc' },
  //   responseSummary: 'JSON array of Advanced ATC (AATC) network sessions.',
  //   queryParams: [
  //     { name: 'airport', required: false, description: 'Filter to one airport ICAO (4 letters).', example: 'EGKK' },
  //     { name: 'page', required: false, description: 'Page number (default 1).', example: '1' },
  //     { name: 'limit', required: false, description: 'Page size (max 100, default 50).', example: '50' },
  //   ],
  // },
  {
    scopeId: 'flights.read',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/sessions\/[^/]+\/flights\/[^/]+$/i,
      pathTemplate: '/sessions/{sessionId}/flights/{flightId}',
    },
    responseSummary:
      'Single flight JSON (sanitized).',
    pathParams: [
      {
        name: 'sessionId',
        description: 'Session identifier.',
        example: 'f0a25bbc',
      },
      {
        name: 'flightId',
        description: 'Flight identifier (8-character alphanumeric).',
        example: 'da8dd255',
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
        example: 'f0a25bbc',
      },
      {
        name: 'flightId',
        description: 'Flight identifier (8-character alphanumeric).',
        example: 'da8dd255',
      },
    ],
    requestBodySummary:
      'Every field is optional; send only what changed. Complete accepted field list: callsign, aircraft, departure, arrival (ICAO — see GET /data/airports; rejected with 400 if not a real airport), flightType (IFR/VFR), route, sid, star (see GET /data/airports/{icao}/sids and /stars), runway (see GET /data/airports/{icao}/runways — rejected with 400 if not a real runway at the flight\'s departure airport, using the new departure if you\'re also changing it in the same request), cruisingFL, clearedFL, squawk, wtc, status, remark, clearance (boolean), stand, gate, hidden (boolean), pdcRemarks, reqAt (ISO timestamp or null), reqPhase (one of C, P, T, G, or null). Unrecognized fields are silently ignored. This action is logged — see GET /flight-logs.',
    requestBodyExampleJson: JSON.stringify({
      status: 'ACTIVE',
      runway: '26L',
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
      'JSON array of flights',
    pathParams: [
      {
        name: 'sessionId',
        description: 'Session you own (created_by matches key owner).',
        example: 'f1a25bac',
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
        example: 'f0a25bac',
      },
    ],
    requestBodySummary:
      "Required: callsign, aircraft, arrival (ICAO — see GET /data/airports; rejected with 400 if not real), cruisingFL. Rejected with 400 if any are missing. Everything else is optional. Accepted fields: callsign, aircraft, flightType (IFR/VFR, defaults to IFR when omitted), arrival (ICAO; rejected if not real), alternate (ICAO; rejected if not real), route, sid (see GET /data/airports/{icao}/sids — auto-generated from the session's airport when omitted), star (see GET /data/airports/{icao}/stars — not auto-filled, null unless you set it), runway (see GET /data/airports/{icao}/runways — defaults to the session's active runway when omitted; rejected with 400 if not a real runway at the session's airport), cruisingFL, clearedFL, stand, gate, remark, flightPlanTime (ISO timestamp, defaults to now), status (defaults to PENDING when omitted), clearance (boolean, defaults to false), hidden (boolean). departure, squawk, wtc, and id are always server-generated, and any value you send for departure/squawk/wtc/id is ignored. This action is logged — see GET /flight-logs.",
    requestBodyExampleJson: JSON.stringify({
      callsign: 'BAW123',
      aircraft: 'A320',
      flightType: 'IFR',
      arrival: 'MDPC',
      cruisingFL: '350',
    }),
  },
  {
    scopeId: 'flights.delete',
    method: 'DELETE',
    pattern: {
      kind: 'regex',
      regex: /^\/sessions\/[^/]+\/flights\/[^/]+$/i,
      pathTemplate: '/sessions/{sessionId}/flights/{flightId}',
    },
    responseSummary:
      'Deletes one flight. Only allowed for sessions created with this same API key (same rule as flight updates). This action is logged — see GET /flight-logs.',
    pathParams: [
      {
        name: 'sessionId',
        description: 'Session you own, created with this same API key.',
        example: 'f0a25bac',
      },
      {
        name: 'flightId',
        description: 'Flight identifier to delete (8-character alphanumeric).',
        example: 'da8dd215',
      },
    ],
    minVersion: 2,
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
      "Session metadata without accessId — the join code is only ever returned once, from POST /sessions at creation time. Save it then if you'll need it.",
    pathParams: [
      {
        name: 'sessionId',
        description: 'Session identifier.',
        example: 'f0a28bac',
      },
    ],
  },
  {
    scopeId: 'sessions.list',
    method: 'GET',
    pattern: { kind: 'exact', path: '/sessions' },
    responseSummary:
      'JSON array of sessions you created. Includes apiManaged when the session was created via the developer API.',
  },
  {
    scopeId: 'sessions.create',
    method: 'POST',
    pattern: { kind: 'exact', path: '/sessions' },
    responseSummary:
      "Creates a session tied to your user and this API key (API-managed). Returns session id and metadata, plus accessId (the join code) — this is the only endpoint that returns it; GET /sessions and GET /sessions/{sessionId} omit it, so save it from this response if you want to open the session in the web UI yourself.",
    requestBodySummary:
      'airportIcao (required — see GET /data/airports for valid ICAO codes; rejected with 400 if not an available airport), activeRunway (required — departure runway; see GET /data/airports/{icao}/runways for valid runways at this airport; rejected if not valid, also requires a departure runway to create a session), optional isPFATC, arrivalRunway (rejected if not valid; defaults to activeRunway when omitted).',
    requestBodyExampleJson: JSON.stringify({
      airportIcao: 'MDPC',
      isPFATC: false,
      isAdvancedATC: false,
      activeRunway: '08',
      arrivalRunway: '09',
    }),
  },
  {
    scopeId: 'sessions.delete',
    method: 'DELETE',
    pattern: {
      kind: 'regex',
      regex: /^\/sessions\/[^/]+$/i,
      pathTemplate: '/sessions/{sessionId}',
    },
    responseSummary:
      'Deletes a session created with this same API key. Flights already logged in the session are not deleted — they remain in place, no longer attached to a live session. Session deletion itself is not recorded in GET /flight-logs (that endpoint only covers flight-level actions); the flights left behind keep their own history.',
    pathParams: [
      {
        name: 'sessionId',
        description: 'Session you own, created with this same API key.',
        example: 'f0a25bat',
      },
    ],
    minVersion: 2,
  },
  {
    scopeId: 'data.airports',
    method: 'GET',
    pattern: { kind: 'exact', path: '/data/airports' },
    responseSummary: 'JSON array of airport objects (static dataset).',
    queryParams: [
      {
        name: 'search',
        required: false,
        description:
          'Case-insensitive substring match against ICAO code, name, or controller name.',
        example: 'punta',
      },
    ],
  },
  {
    scopeId: 'data.airports',
    method: 'GET',
    pattern: {
      kind: 'regex',
      regex: /^\/data\/airports\/[^/]+$/i,
      pathTemplate: '/data/airports/{icao}',
    },
    responseSummary:
      'Single airport object by ICAO code (case-insensitive), or 404 if not found. Uses the same scope as the full airport list.',
    pathParams: [
      {
        name: 'icao',
        description: 'Airport ICAO code (case-insensitive).',
        example: 'EGKK',
      },
    ],
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
    responseSummary:
      'JSON object with path (waypoint ids), distance, success. success is false (not a 400) if from/to aren\'t airports the route graph recognizes.',
    queryParams: [
      {
        name: 'from',
        required: true,
        description:
          'Departure airport ICAO (see GET /data/airports) — must be an airport.',
        example: 'EGKK',
      },
      {
        name: 'to',
        required: true,
        description:
          'Arrival airport ICAO (see GET /data/airports) — must be an airport.',
        example: 'MDPC',
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
        example: 'EGKK',
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
        example: 'EGKK',
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
        example: 'EGKK',
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
      'JSON with active PFATC/Advanced session summary, controller, departureRunway, arrivalRunway (activeRunway kept for backwards compatibility, same value as departureRunway), flight count, METAR when available.',
    pathParams: [
      {
        name: 'icao',
        description: 'Airport ICAO code.',
        example: 'EGKK',
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
  pathNoQuery: string,
  version: 1 | 2 = 1
): string | null {
  const p = pathNoQuery.split('?')[0];
  for (const r of DEVELOPER_EXT_ROUTES) {
    if ((r.minVersion ?? 1) > version) continue;
    if (r.method !== method) continue;
    if (r.pattern.kind === 'exact' && r.pattern.path === p) return r.scopeId;
    if (r.pattern.kind === 'regex' && r.pattern.regex.test(p)) return r.scopeId;
  }
  return null;
}

/** @deprecated Use matchExtDeveloperRoute; kept for internal naming continuity. */
export const matchExtDataRoute = matchExtDeveloperRoute;
