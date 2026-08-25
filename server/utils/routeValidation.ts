import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_ROUTE_CHARS = 500;
const MAX_ROUTE_FIXES = 50;
const FIX_NAME = /^[A-Z0-9]{2,5}$/;
const PROCEDURE_NAME = /^[A-Z]{2,5}\d[A-Z]?$/;
const DIRECT = 'DCT';

interface WaypointEntry {
  name: string;
  type: string;
}

let fixNamesCache: Set<string> | null = null;

function loadFixNames(): Set<string> {
  if (fixNamesCache) return fixNamesCache;
  try {
    const waypointsPath = path.join(
      __dirname,
      '..',
      'data',
      'waypointData.json'
    );
    const data = JSON.parse(
      fs.readFileSync(waypointsPath, 'utf8')
    ) as WaypointEntry[];
    fixNamesCache = new Set(
      data
        .filter(
          (d) =>
            d.type === 'WAYPOINT' ||
            d.type === 'NDB' ||
            d.type === 'VOR-DME' ||
            d.type === 'AIRPORT'
        )
        .map((d) => d.name.toUpperCase())
    );
  } catch {
    fixNamesCache = new Set();
  }
  return fixNamesCache;
}

function routeTokens(route: string): string[] {
  return route.trim().toUpperCase().split(/\s+/).filter(Boolean);
}

function looksLikeProcedure(token: string): boolean {
  return PROCEDURE_NAME.test(token);
}

export function validateRouteLength(route: string): string | undefined {
  return route.trim().length > MAX_ROUTE_CHARS
    ? `A route may be at most ${MAX_ROUTE_CHARS} characters.`
    : undefined;
}

export function validateRoute(
  route: string,
  departureIcao?: string | null,
  arrivalIcao?: string | null
): string | undefined {
  const lengthError = validateRouteLength(route);
  if (lengthError) return lengthError;

  let tokens = routeTokens(route);
  if (tokens.length === 0) return undefined;

  if (departureIcao && tokens[0] === departureIcao.toUpperCase()) {
    tokens = tokens.slice(1);
  }
  if (
    arrivalIcao &&
    tokens.length > 0 &&
    tokens[tokens.length - 1] === arrivalIcao.toUpperCase()
  ) {
    tokens = tokens.slice(0, -1);
  }

  if (tokens.length > 0 && looksLikeProcedure(tokens[0])) {
    tokens = tokens.slice(1);
  }
  if (tokens.length > 0 && looksLikeProcedure(tokens[tokens.length - 1])) {
    tokens = tokens.slice(0, -1);
  }

  const enrouteTokens = tokens.filter((token) => token !== DIRECT);
  if (enrouteTokens.length > MAX_ROUTE_FIXES) {
    return `A route may name at most ${MAX_ROUTE_FIXES} fixes.`;
  }

  const NOT_A_FIX_HINT =
    'Route by fix idents, SIDs/STARs, and DCT. Put vectors or other notes in Remarks instead.';

  const fixes = loadFixNames();
  let previous: string | undefined;
  for (const token of enrouteTokens) {
    if (!FIX_NAME.test(token)) {
      return `"${token}" is not a fix. ${NOT_A_FIX_HINT}`;
    }
    if (fixes.size > 0 && !fixes.has(token)) {
      return `"${token}" is not a known fix. ${NOT_A_FIX_HINT}`;
    }
    if (token === previous) {
      return `"${token}" is routed twice in a row.`;
    }
    previous = token;
  }
  return undefined;
}
