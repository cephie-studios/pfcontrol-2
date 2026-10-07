import type { BundledChart } from './acars';
import type { CelesbitPlate, ChartfoxChartSummary } from './fetch/charts';
import { celesbitPlateUrl } from './fetch/charts';

export type ChartSource = 'pfatc' | 'cephie' | 'celesbit' | 'chartfox';

export type ChartCategory =
  | 'ground'
  | 'sid'
  | 'star'
  | 'approach'
  | 'transition'
  | 'general'
  | 'briefing'
  | 'other';

export interface ChartEntry {
  id: string;
  airport: string;
  name: string;
  code: string | null;
  category: ChartCategory;
  source: ChartSource;
  credits: string | null;
  procedures: string[];
  runways: string[];
  imageUrl: string | null;
  chartfoxId: string | null;
  viewUrl: string | null;
}

export const CATEGORY_ORDER: ChartCategory[] = [
  'general',
  'ground',
  'sid',
  'star',
  'approach',
  'transition',
  'briefing',
  'other',
];

export const CATEGORY_LABELS: Record<ChartCategory, string> = {
  ground: 'Ground',
  sid: 'Departure',
  star: 'Arrival',
  approach: 'Approach',
  transition: 'Transition',
  general: 'Information',
  briefing: 'Briefing',
  other: 'Other',
};

export const CHARTFOX_LOGO_URL = '/assets/images/chartfox.webp';

export const SOURCE_ORDER: ChartSource[] = [
  'cephie',
  'pfatc',
  'chartfox',
  'celesbit',
];

export const SOURCE_LABELS: Record<ChartSource, string> = {
  pfatc: 'PFATC',
  cephie: 'Cephie',
  celesbit: 'Celesbit',
  chartfox: 'ChartFox',
};

const BUNDLED_TYPE_CATEGORY: Record<string, ChartCategory> = {
  ground: 'ground',
  departure: 'sid',
  arrival: 'star',
  approach: 'approach',
  information: 'general',
};

const CELESBIT_KIND_CATEGORY: Record<string, ChartCategory> = {
  GND: 'ground',
  DEP: 'sid',
  ARR: 'star',
  APP: 'approach',
};

const CHARTFOX_TYPE_CATEGORY: Record<number, ChartCategory> = {
  0: 'general',
  1: 'general',
  2: 'general',
  3: 'ground',
  4: 'sid',
  5: 'star',
  6: 'approach',
  7: 'transition',
  99: 'briefing',
};

const GROUND_MOVEMENT_PATTERN =
  /ground\s*movement|taxi|parking|stand|apron|docking|de-?icing/i;

function refineGroundCategory(
  category: ChartCategory,
  name: string
): ChartCategory {
  if (category !== 'ground') return category;
  return GROUND_MOVEMENT_PATTERN.test(name) ? 'ground' : 'general';
}

export function fromBundled(icao: string, chart: BundledChart): ChartEntry {
  return {
    id: `pfatc:${chart.path}`,
    airport: icao,
    name: chart.name,
    code: null,
    category: refineGroundCategory(
      BUNDLED_TYPE_CATEGORY[chart.type.toLowerCase()] ?? 'other',
      chart.name
    ),
    source: chart.source ?? 'pfatc',
    credits: chart.credits ?? null,
    procedures: chart.procedures ?? [],
    runways: [],
    imageUrl: chart.path,
    chartfoxId: null,
    viewUrl: null,
  };
}

export function fromCelesbit(icao: string, plate: CelesbitPlate): ChartEntry {
  return {
    id: `celesbit:${icao}:${plate.file}`,
    airport: icao,
    name: plate.label,
    code: null,
    category: refineGroundCategory(
      CELESBIT_KIND_CATEGORY[plate.kind] ?? 'other',
      plate.label
    ),
    source: 'celesbit',
    credits: '© Gavin Ostler',
    // Lets "BPK1H" match a plate labelled "BPK 1H".
    procedures: [plate.label.replace(/\s+/g, '')],
    runways: [],
    imageUrl: celesbitPlateUrl(icao, plate.file),
    chartfoxId: null,
    viewUrl: null,
  };
}

export function fromChartfox(
  icao: string,
  chart: ChartfoxChartSummary
): ChartEntry {
  return {
    id: `chartfox:${chart.id}`,
    airport: icao,
    name: chart.name,
    code: chart.code,
    category: refineGroundCategory(
      CHARTFOX_TYPE_CATEGORY[chart.type] ?? 'other',
      chart.name
    ),
    source: 'chartfox',
    credits: null,
    procedures: chart.procedures,
    runways: chart.runways,
    imageUrl: null,
    chartfoxId: chart.id,
    viewUrl: chart.viewUrl,
  };
}

export function chartMatchesQuery(chart: ChartEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const compact = q.replace(/\s+/g, '');
  return [
    chart.name,
    chart.code ?? '',
    chart.airport,
    CATEGORY_LABELS[chart.category],
    SOURCE_LABELS[chart.source],
    chart.credits ?? '',
    ...chart.procedures,
    ...chart.runways.map((rwy) => `rwy ${rwy}`),
  ].some((field) => {
    const value = field.toLowerCase();
    return value.includes(q) || value.replace(/\s+/g, '').includes(compact);
  });
}

export function groupByCategory(charts: ChartEntry[]) {
  return CATEGORY_ORDER.map((category) => ({
    category,
    charts: charts
      .filter((chart) => chart.category === category)
      .sort(
        (a, b) =>
          SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source)
      ),
  })).filter((group) => group.charts.length > 0);
}
