export {
  matchExtDataRoute,
  matchExtDeveloperRoute,
  DEVELOPER_EXT_ROUTES,
} from './extRoutes.js';
export type {
  DeveloperExtRouteDefinition,
  DeveloperExtRouteParamDoc,
  DeveloperExtRouteQueryDoc,
} from './extRoutes.js';

export interface DeveloperScopeCatalogEntry {
  id: string;
  label: string;
  description: string;
}

export const DEVELOPER_SCOPE_CATALOG: DeveloperScopeCatalogEntry[] = [
  {
    id: 'data.airports',
    label: 'Airport directory',
    description: 'Full airport dataset (ICAO, runways metadata bundle, etc.).',
  },
  {
    id: 'data.aircrafts',
    label: 'Aircraft types',
    description: 'Aircraft reference data.',
  },
  {
    id: 'data.airlines',
    label: 'Airlines',
    description: 'Airline reference data.',
  },
  {
    id: 'data.frequencies',
    label: 'Frequencies summary',
    description: 'Per-airport frequency summaries derived from airport data.',
  },
  {
    id: 'data.backgrounds',
    label: 'Background assets',
    description: 'List of available session background images.',
  },
  {
    id: 'data.airport_runways',
    label: 'Airport runways',
    description:
      'GET /data/airports/:icao/runways — runway list for one airport.',
  },
  {
    id: 'data.airport_sids',
    label: 'Airport SIDs',
    description: 'GET /data/airports/:icao/sids — SID definitions.',
  },
  {
    id: 'data.airport_stars',
    label: 'Airport STARs',
    description: 'GET /data/airports/:icao/stars — STAR definitions.',
  },
  {
    id: 'data.find_route',
    label: 'Route finder',
    description:
      'GET /data/findRoute?from=&to= — waypoint graph route between fixes.',
  },
  {
    id: 'data.airport_status',
    label: 'Airport status',
    description:
      'GET /data/airports/:icao/status — active PFATC session, METAR, etc.',
  },
  {
    id: 'sessions.network_pfatc',
    label: 'PFATC sessions',
    description:
      'GET /sessions/network/pfatc — list PFATC network sessions worldwide (sanitized). Optional GET /sessions/network/pfatc/{sessionId} for one row. No access_id or ATIS.',
  },
  // AATC disabled — sessions.network_aatc scope commented out
  // {
  //   id: 'sessions.network_aatc',
  //   label: 'AATC sessions',
  //   description: 'GET /sessions/network/aatc — list Advanced ATC (AATC) network sessions worldwide.',
  // },
  {
    id: 'sessions.list',
    label: 'List my sessions',
    description:
      'GET /sessions — sessions you created; join codes are never returned.',
  },
  {
    id: 'sessions.create',
    label: 'Create session',
    description:
      'POST /sessions — creates a session tied to this API key (API-managed for scoped updates).',
  },
  {
    id: 'sessions.read',
    label: 'Read session',
    description:
      'GET /sessions/:sessionId — metadata for a session you own (no access_id).',
  },
  {
    id: 'flights.list',
    label: 'List session flights',
    description:
      'GET /sessions/:sessionId/flights — all flights in a session you own (sanitized).',
  },
  {
    id: 'flights.read',
    label: 'Read flight',
    description:
      'GET /sessions/:sessionId/flights/:flightId — one flight (sanitized).',
  },
  {
    id: 'flights.create',
    label: 'Create flight',
    description:
      'POST /sessions/:sessionId/flights — add a flight to a session you own.',
  },
  {
    id: 'flights.update',
    label: 'Update flight',
    description:
      'PUT /sessions/:sessionId/flights/:flightId — update only for sessions created with this same API key.',
  },
  {
    id: 'ratings.controller_stats',
    label: 'Controller rating stats',
    description:
      'GET /ratings/controllers/{controllerId}/stats — aggregate average and count only (no pilot rows).',
  },
  {
    id: 'notifications.read',
    label: 'Active notifications',
    description:
      'GET /notifications/active — public announcement banners (no admin CRUD).',
  },
  {
    id: 'flight_logs.read',
    label: 'Own session flight logs (metadata)',
    description:
      'GET /flight-logs — audit metadata for sessions you own; no IPs, no old/new JSON bodies.',
  },
];

export const ALL_DEVELOPER_SCOPE_IDS: string[] = DEVELOPER_SCOPE_CATALOG.map(
  (s) => s.id
);

export function isValidScopeList(scopes: unknown): scopes is string[] {
  if (!Array.isArray(scopes)) return false;
  if (scopes.length === 0) return false;
  const set = new Set(ALL_DEVELOPER_SCOPE_IDS);
  return scopes.every((s) => typeof s === 'string' && set.has(s));
}

export function isScopeSubset(scopes: string[], allowed: string[]): boolean {
  const allow = new Set(allowed);
  return scopes.every((s) => allow.has(s));
}
