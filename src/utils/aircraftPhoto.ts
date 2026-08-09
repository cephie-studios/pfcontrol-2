export type AircraftPhotoTier = 'match' | 'random' | 'none';

export interface AircraftPhotoPick {
  tier: Exclude<AircraftPhotoTier, 'none'>;
  livery: string;
  filename: string;
}

const AIRCRAFT_TYPE_TO_FOLDER: Record<string, string | string[]> = {
  A220: 'AirbusA220',
  A320: 'AirbusA320',
  A330: 'AirbusA330',
  A350: 'AirbusA350',
  B717: 'Boeing717',
  B737: 'Boeing737',
  B757: ['Boeing757_PW', 'Boeing757_RR'],
  B77W: 'Boeing777',
  B787: 'Boeing787',
  BE58: 'BaronG58',
  C150: 'Cessna150',
  C550: 'Citation550',
  DH8D: 'Q400',
  EUFI: 'EurofighterTyphoon',
  F100: 'Fokker100',
  HAWK: 'HawkT1',
  MD11: 'MD-11',
  TBM9: 'TBM900',
};

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickDeterministic<T>(items: T[], seed: string): T {
  return items[hashString(seed) % items.length];
}

export function resolveAircraftFolder(
  aircraftType: string | undefined
): string | null {
  if (!aircraftType) return null;
  const key = aircraftType.trim().toUpperCase();
  const folder = AIRCRAFT_TYPE_TO_FOLDER[key];
  if (!folder) return null;
  return Array.isArray(folder) ? pickDeterministic(folder, key) : folder;
}

export function extractAirlineIcaoPrefix(
  callsign: string | undefined
): string | null {
  if (!callsign) return null;
  const match = callsign.trim().toUpperCase().match(/^([A-Z]{2,3})(.+)$/);
  return match ? match[1] : null;
}

export function parseAuthorFromFilename(filename: string): string | null {
  const match = filename.match(/^(.+)-\d+\.\w+$/);
  return match ? match[1] : null;
}

const normalizeLiveryName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');

export function pickLiveryAndFile(
  manifest: Record<string, string[]>,
  airlineName: string | null,
  seed: string
): AircraftPhotoPick | null {
  const liveries = Object.keys(manifest).filter(
    (key) => (manifest[key]?.length ?? 0) > 0
  );
  if (liveries.length === 0) return null;

  let matchedLivery: string | null = null;
  if (airlineName) {
    const normAirline = normalizeLiveryName(airlineName);
    matchedLivery =
      liveries.find((livery) => {
        const normLivery = normalizeLiveryName(livery);
        return (
          normLivery === normAirline ||
          normLivery.includes(normAirline) ||
          normAirline.includes(normLivery)
        );
      }) ?? null;
  }

  const tier: AircraftPhotoPick['tier'] = matchedLivery ? 'match' : 'random';
  const livery = matchedLivery ?? pickDeterministic(liveries, seed);
  const filename = pickDeterministic(manifest[livery], `${seed}:${livery}`);
  return { tier, livery, filename };
}

export function buildManifestUrl(apiBase: string, folder: string): string {
  return `${apiBase}/assets/app/pfphotos/${encodeURIComponent(folder)}/manifest.json`;
}

export function buildAircraftPhotoUrl(
  apiBase: string,
  folder: string,
  livery: string,
  filename: string
): string {
  return `${apiBase}/assets/app/pfphotos/${encodeURIComponent(folder)}/${encodeURIComponent(livery)}/${encodeURIComponent(filename)}`;
}
