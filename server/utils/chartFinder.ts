import {
  alignToOriginal,
  downsample,
  downsampleGrid,
  loadGray,
  nccSearch,
  type Grid,
} from './chartForensics.js';
import type { PreAligned } from './chartAnalysis.js';
import { alignScaled, coarseCandidates } from './chartScaled.js';
import {
  candidateCharts,
  rankCharts,
  type ChartRef,
  type Vocabulary,
} from './chartIdentify.js';

const FINE_FACTOR = 16;
const COARSE_FACTOR = 32;
const TEMPLATE_MAX_PX = 3000;
const MIN_TEMPLATE_SIDE = 6;
const MIN_APPEARANCE_SCORE = 0.3;
const STRONG_APPEARANCE_SCORE = 0.45;
const APPEARANCE_TOP = 30;
const STRONG_TOP = 12;
const ALTERNATIVE_MARGIN = 0.02;
const NEAR_TIE = 0.9;
const TEXT_TOP = 12;
const SCALED_TRIES = 6;
const SCALED_ALIGNMENTS = 2;
const CONFIDENT_ALIGNMENT = 0.97;
const BUILD_CONCURRENCY = 4;

interface Descriptor {
  ref: ChartRef;
  fine: Grid;
  coarse: Grid;
}

export type FetchOriginal = (chart: ChartRef) => Promise<Buffer | null>;

export interface FoundChart {
  chart: ChartRef;
  original: Buffer;
  quality: number;
  preAligned: PreAligned;
  via: 'appearance' | 'text';
  matchedWords: string[];
}

export interface FindResult {
  found: FoundChart | null;
  alternatives: ChartRef[];
  wordsRead: number;
  tried: number;
}

const descriptorCache = new Map<string, Promise<Descriptor[]>>();

async function buildDescriptors(
  charts: ChartRef[],
  fetchOriginal: FetchOriginal
): Promise<Descriptor[]> {
  const descriptors: Descriptor[] = [];
  let next = 0;
  const worker = async () => {
    while (next < charts.length) {
      const ref = charts[next++];
      try {
        const original = await fetchOriginal(ref);
        if (!original) continue;
        const fine = downsample(await loadGray(original), FINE_FACTOR);
        descriptors.push({
          ref,
          fine,
          coarse: downsampleGrid(fine, COARSE_FACTOR / FINE_FACTOR),
        });
      } catch (error) {
        console.warn(
          `[Charts] No descriptor for ${ref.icao}/${ref.kind}:`,
          error
        );
      }
    }
  };
  await Promise.all(Array.from({ length: BUILD_CONCURRENCY }, worker));
  return descriptors;
}

function getDescriptors(
  version: string,
  charts: ChartRef[],
  fetchOriginal: FetchOriginal
): Promise<Descriptor[]> {
  let pending = descriptorCache.get(version);
  if (!pending) {
    descriptorCache.clear();
    pending = buildDescriptors(charts, fetchOriginal).catch((error) => {
      descriptorCache.delete(version);
      throw error;
    });
    descriptorCache.set(version, pending);
  }
  return pending;
}

function matchAppearance(
  leaked: Awaited<ReturnType<typeof loadGray>>,
  descriptors: Descriptor[]
): { ref: ChartRef; score: number }[] {
  let level: 'fine' | 'coarse' = 'fine';
  let template = downsample(leaked, FINE_FACTOR);
  if (template.width * template.height > TEMPLATE_MAX_PX) {
    level = 'coarse';
    template = downsample(leaked, COARSE_FACTOR);
  }
  if (
    template.width < MIN_TEMPLATE_SIDE ||
    template.height < MIN_TEMPLATE_SIDE
  ) {
    return [];
  }

  const step = level === 'fine' ? 2 : 1;
  const scored: { ref: ChartRef; score: number }[] = [];
  for (const descriptor of descriptors) {
    const best = nccSearch(descriptor[level], template, step);
    if (best && best.score >= MIN_APPEARANCE_SCORE) {
      scored.push({ ref: descriptor.ref, score: best.score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, APPEARANCE_TOP);
}

export async function findChart(input: {
  version: string;
  charts: ChartRef[];
  vocabulary: Vocabulary;
  leaked: Buffer;
  fetchOriginal: FetchOriginal;
  readText: (image: Buffer) => Promise<string[]>;
}): Promise<FindResult> {
  const leakedGray = await loadGray(input.leaked);
  const tried = new Set<string>();
  const results: FoundChart[] = [];
  const key = (chart: ChartRef) => `${chart.icao}/${chart.kind}`;

  const attempt = async (
    candidates: { chart: ChartRef; matched: string[]; score?: number }[],
    via: FoundChart['via']
  ) => {
    let confidentScore: number | null = null;
    for (const { chart, matched, score } of candidates) {
      if (tried.has(key(chart))) continue;
      if (
        confidentScore !== null &&
        (score === undefined || score < NEAR_TIE * confidentScore)
      ) {
        break;
      }
      tried.add(key(chart));
      const original = await input.fetchOriginal(chart);
      if (!original) continue;
      const aligned = alignToOriginal(await loadGray(original), leakedGray);
      if (!('alignment' in aligned)) continue;
      results.push({
        chart,
        original,
        quality: aligned.alignment.quality,
        preAligned: { mode: 'native', alignment: aligned.alignment },
        via,
        matchedWords: matched,
      });
      if (
        confidentScore === null &&
        aligned.alignment.quality >= CONFIDENT_ALIGNMENT
      ) {
        confidentScore = score ?? Number.POSITIVE_INFINITY;
      }
    }
  };

  const summarise = (wordsRead: number): FindResult => {
    const ranked = [...results].sort((a, b) => b.quality - a.quality);
    const found = ranked[0] ?? null;
    return {
      found,
      alternatives: found
        ? ranked
            .slice(1)
            .filter(
              (other) => other.quality >= found.quality - ALTERNATIVE_MARGIN
            )
            .map((other) => other.chart)
        : [],
      wordsRead,
      tried: tried.size,
    };
  };

  const descriptors = await getDescriptors(
    input.version,
    input.charts,
    input.fetchOriginal
  );
  const appearanceMatches = matchAppearance(leakedGray, descriptors);
  const toCandidates = (list: typeof appearanceMatches) =>
    list.map(({ ref, score }) => ({ chart: ref, matched: [], score }));
  await attempt(
    toCandidates(
      appearanceMatches
        .filter((match) => match.score >= STRONG_APPEARANCE_SCORE)
        .slice(0, STRONG_TOP)
    ),
    'appearance'
  );
  if (results.some((r) => r.quality >= CONFIDENT_ALIGNMENT)) {
    return summarise(0);
  }

  const words = await input.readText(input.leaked).catch(() => []);
  const textCandidates = candidateCharts(
    rankCharts(words, input.vocabulary),
    TEXT_TOP
  );
  await attempt(textCandidates, 'text');
  if (results.length > 0) return summarise(words.length);

  const scaled: {
    chart: ChartRef;
    matched: string[];
    original: Buffer;
    gray: Awaited<ReturnType<typeof loadGray>>;
    significance: number;
  }[] = [];
  for (const { chart, matched } of textCandidates.slice(0, SCALED_TRIES)) {
    const original = await input.fetchOriginal(chart);
    if (!original) continue;
    const gray = await loadGray(original);
    const [best] = await coarseCandidates(gray, leakedGray);
    if (best) {
      scaled.push({
        chart,
        matched,
        original,
        gray,
        significance: best.significance,
      });
    }
  }
  scaled.sort((a, b) => b.significance - a.significance);
  for (const entry of scaled.slice(0, SCALED_ALIGNMENTS)) {
    const aligned = await alignScaled(entry.gray, leakedGray);
    if (!aligned) continue;
    results.push({
      chart: entry.chart,
      original: entry.original,
      quality: aligned.alignment.quality,
      preAligned: { mode: 'scaled', alignment: aligned.alignment },
      via: 'text',
      matchedWords: entry.matched,
    });
  }
  if (results.length === 0) {
    await attempt(toCandidates(appearanceMatches), 'appearance');
  }
  return summarise(words.length);
}
