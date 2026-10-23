import { normalizeToken } from './chartOcr.js';

const ICAO_WEIGHT = 3;
const MAX_FREQUENCY_DECIMALS = 3;

export interface CephieIndexChart {
  kind: string;
  code?: string;
  name: string;
  category?: string;
  procedures?: string[];
  runways?: string[];
}

export interface AirportInfo {
  icao: string;
  name?: string;
  controlName?: string;
  runways?: string[];
  allFrequencies?: Record<string, string>;
  sidWaypoints?: Record<string, string[]>;
  starWaypoints?: Record<string, string[]>;
}

export interface ChartRef {
  icao: string;
  kind: string;
  name: string;
}

interface Term {
  weight: number;
  label: string;
}

export interface Vocabulary {
  charts: { ref: ChartRef; terms: Map<string, Term> }[];
  documentFrequency: Map<string, number>;
}

export interface ChartRanking {
  chart: ChartRef;
  score: number;
  matched: string[];
}

const LOOKALIKES: Record<string, string> = {
  O: '0',
  Q: '0',
  D: '0',
  I: '1',
  L: '1',
  T: '1',
  S: '5',
  B: '8',
  Z: '2',
};

export function foldToken(token: string): string {
  return token.replace(/[OQDILTSBZ]/g, (char) => LOOKALIKES[char]);
}

function addTerms(
  terms: Map<string, Term>,
  values: (string | undefined)[],
  weight = 1
) {
  for (const value of values) {
    if (!value) continue;
    for (const part of value.split(/\s+/)) {
      const token = normalizeToken(part);
      if (token.length < 2) continue;
      const folded = foldToken(token);
      const existing = terms.get(folded);
      if (!existing || existing.weight < weight) {
        terms.set(folded, { weight, label: token });
      }
    }
  }
}

function frequencyVariants(frequency: string): string[] {
  const [whole, decimals = ''] = frequency.split('.');
  const variants = new Set([frequency]);
  const trimmed = decimals.replace(/0+$/, '');
  if (trimmed) variants.add(`${whole}.${trimmed}`);
  variants.add(`${whole}.${decimals.padEnd(MAX_FREQUENCY_DECIMALS, '0')}`);
  return [...variants];
}

export function buildVocabulary(
  index: Record<string, CephieIndexChart[]>,
  airports: AirportInfo[]
): Vocabulary {
  const byIcao = new Map(airports.map((airport) => [airport.icao, airport]));
  const charts: Vocabulary['charts'] = [];
  const documentFrequency = new Map<string, number>();

  for (const [icao, list] of Object.entries(index)) {
    const airport = byIcao.get(icao);
    for (const chart of list) {
      const terms = new Map<string, Term>();
      addTerms(terms, [icao], ICAO_WEIGHT);
      addTerms(terms, [airport?.name, airport?.controlName]);
      addTerms(terms, airport?.runways ?? []);
      addTerms(
        terms,
        Object.values(airport?.allFrequencies ?? {}).flatMap(frequencyVariants)
      );
      addTerms(terms, [chart.name, chart.code, chart.category]);
      addTerms(terms, chart.procedures ?? []);
      addTerms(terms, chart.runways ?? []);
      for (const procedure of chart.procedures ?? []) {
        addTerms(terms, [
          ...(airport?.sidWaypoints?.[procedure] ?? []),
          ...(airport?.starWaypoints?.[procedure] ?? []),
        ]);
      }
      charts.push({ ref: { icao, kind: chart.kind, name: chart.name }, terms });
      for (const term of terms.keys()) {
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      }
    }
  }
  return { charts, documentFrequency };
}

export function rankCharts(
  words: string[],
  vocabulary: Vocabulary
): ChartRanking[] {
  const total = vocabulary.charts.length || 1;
  const read = new Set(
    words
      .map(normalizeToken)
      .filter((w) => w.length >= 2)
      .map(foldToken)
  );

  return vocabulary.charts
    .map(({ ref, terms }) => {
      let score = 0;
      const matched: string[] = [];
      for (const [folded, { weight, label }] of terms) {
        if (!read.has(folded)) continue;
        const frequency = vocabulary.documentFrequency.get(folded) ?? total;
        const rarity = Math.log(1 + total / frequency);
        score += rarity * weight;
        matched.push(label);
      }
      return { chart: ref, score, matched };
    })
    .filter((ranking) => ranking.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function candidateCharts(
  rankings: ChartRanking[],
  limit: number
): ChartRanking[] {
  const best = rankings[0];
  if (!best) return [];
  const airportScores = new Map<string, number>();
  for (const { chart, score } of rankings) {
    airportScores.set(
      chart.icao,
      Math.max(airportScores.get(chart.icao) ?? 0, score)
    );
  }
  const topAirports = [...airportScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([icao]) => icao);
  return rankings
    .filter((ranking) => topAirports.includes(ranking.chart.icao))
    .slice(0, limit);
}
