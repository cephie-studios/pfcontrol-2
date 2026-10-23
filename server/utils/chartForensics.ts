import sharp from 'sharp';
import {
  BASE_AMPLITUDE,
  CELL_PX,
  cellColumns,
  noiseValue,
  seedFromKey,
  watermarkSeedKey,
} from './chartWatermark.js';

const MIN_CROP_PX = 192;
const COARSE_TEMPLATE_PX = 3000;
const REFINE_SAMPLES = 4000;
const ALIGN_TOLERANCE = 16;
const ALIGN_MIN_QUALITY = 0.85;
const DIFF_OUTLIER = 40;
const DARK_PIXEL = 10;
const MIN_VALID_PIXELS = 5;
const MIN_CELLS = 400;
const MATCH_Z = 8;
const POSSIBLE_Z = 5;
const TOP_MATCHES = 10;
const CANDIDATES_PER_TICK = 20;
const BLANK_PIXEL = 235;
const MIN_CONTENT_SAMPLES = 50;
const SCREEN_CELLS = 100_000;
const RESCORE_TOP = 25;

export interface Gray {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface Alignment {
  dx: number;
  dy: number;
  width: number;
  height: number;
  quality: number;
  scale?: number;
}

export interface Candidate {
  userId: string;
  username: string;
}

export interface CandidateScore extends Candidate {
  z: number;
  correlation: number;
  level: number;
}

export type Verdict = 'match' | 'possible' | 'none';

export type LeakAnalysis =
  | { aligned: false; reason: string }
  | {
      aligned: true;
      alignment: Alignment;
      chart: { width: number; height: number };
      cells: number;
      noiseStd: number;
      verdict: Verdict;
      matches: CandidateScore[];
      candidatesTested: number;
    };

export async function loadGray(image: Buffer): Promise<Gray> {
  const { data, info } = await sharp(image)
    .flatten({ background: '#ffffff' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export interface Grid {
  data: Float32Array;
  width: number;
  height: number;
}

export function downsample(gray: Gray, factor: number): Grid {
  const width = Math.floor(gray.width / factor);
  const height = Math.floor(gray.height / factor);
  const out = new Float32Array(width * height);
  const area = factor * factor;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let j = 0; j < factor; j++) {
        const row = (y * factor + j) * gray.width + x * factor;
        for (let i = 0; i < factor; i++) sum += gray.data[row + i];
      }
      out[y * width + x] = sum / area;
    }
  }
  return { data: out, width, height };
}

function coarseSearch(original: Gray, leaked: Gray, factor: number) {
  return nccSearch(downsample(original, factor), downsample(leaked, factor));
}

export function downsampleGrid(grid: Grid, factor: number): Grid {
  const width = Math.floor(grid.width / factor);
  const height = Math.floor(grid.height / factor);
  const data = new Float32Array(width * height);
  const area = factor * factor;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let j = 0; j < factor; j++) {
        const row = (y * factor + j) * grid.width + x * factor;
        for (let i = 0; i < factor; i++) sum += grid.data[row + i];
      }
      data[y * width + x] = sum / area;
    }
  }
  return { data, width, height };
}

export function nccSearch(search: Grid, template: Grid, step = 1) {
  if (template.width > search.width || template.height > search.height) {
    return null;
  }
  const count = template.width * template.height;

  let mean = 0;
  for (let i = 0; i < count; i++) mean += template.data[i];
  mean /= count;
  const centered = new Float32Array(count);
  let norm = 0;
  for (let i = 0; i < count; i++) {
    centered[i] = template.data[i] - mean;
    norm += centered[i] * centered[i];
  }
  if (norm < 1) return null;

  const stride = search.width + 1;
  const sum = new Float64Array(stride * (search.height + 1));
  const sumSquares = new Float64Array(stride * (search.height + 1));
  for (let y = 0; y < search.height; y++) {
    let rowSum = 0;
    let rowSquares = 0;
    for (let x = 0; x < search.width; x++) {
      const value = search.data[y * search.width + x];
      rowSum += value;
      rowSquares += value * value;
      sum[(y + 1) * stride + x + 1] = sum[y * stride + x + 1] + rowSum;
      sumSquares[(y + 1) * stride + x + 1] =
        sumSquares[y * stride + x + 1] + rowSquares;
    }
  }
  const box = (table: Float64Array, x: number, y: number) =>
    table[(y + template.height) * stride + x + template.width] -
    table[y * stride + x + template.width] -
    table[(y + template.height) * stride + x] +
    table[y * stride + x];

  let best = { score: -Infinity, x: 0, y: 0 };
  for (let y = 0; y <= search.height - template.height; y += step) {
    for (let x = 0; x <= search.width - template.width; x += step) {
      const patchSum = box(sum, x, y);
      const variance = box(sumSquares, x, y) - (patchSum * patchSum) / count;
      if (variance < 1) continue;
      let dot = 0;
      for (let j = 0; j < template.height; j++) {
        const searchRow = (y + j) * search.width + x;
        const templateRow = j * template.width;
        for (let i = 0; i < template.width; i++) {
          dot += search.data[searchRow + i] * centered[templateRow + i];
        }
      }
      const score = dot / Math.sqrt(variance * norm);
      if (score > best.score) best = { score, x, y };
    }
  }
  return Number.isFinite(best.score) ? best : null;
}

function agreement(
  original: Gray,
  leaked: Gray,
  dx: number,
  dy: number,
  samples: number
) {
  const step = Math.max(
    1,
    Math.floor(Math.sqrt((leaked.width * leaked.height) / samples))
  );
  let total = 0;
  let close = 0;
  let error = 0;
  for (let y = 0; y < leaked.height; y += step) {
    for (let x = 0; x < leaked.width; x += step) {
      const a = leaked.data[y * leaked.width + x];
      const b = original.data[(y + dy) * original.width + x + dx];
      if (a >= BLANK_PIXEL && b >= BLANK_PIXEL) continue;
      const diff = Math.abs(a - b);
      total++;
      error += diff;
      if (diff <= ALIGN_TOLERANCE) close++;
    }
  }
  if (total < MIN_CONTENT_SAMPLES) return { quality: 0, error: Infinity };
  return { quality: close / total, error: error / total };
}

export function alignToOriginal(
  original: Gray,
  leaked: Gray
): { alignment: Alignment } | { reason: string } {
  if (leaked.width > original.width || leaked.height > original.height) {
    return {
      reason:
        'The image is larger than the chart, so it was scaled up or screenshotted. The noise fingerprint does not survive resizing.',
    };
  }
  if (leaked.width < MIN_CROP_PX || leaked.height < MIN_CROP_PX) {
    return {
      reason: `The image is too small to analyse (minimum ${MIN_CROP_PX}px).`,
    };
  }

  const whole =
    leaked.width === original.width && leaked.height === original.height;
  let dx = 0;
  let dy = 0;
  let factor = 1;

  if (!whole) {
    factor = Math.max(
      1,
      Math.ceil(Math.sqrt((leaked.width * leaked.height) / COARSE_TEMPLATE_PX))
    );
    const coarse = coarseSearch(original, leaked, factor);
    if (!coarse) {
      return {
        reason: 'The image has too little detail to locate on the chart.',
      };
    }
    const coarseX = coarse.x * factor;
    const coarseY = coarse.y * factor;
    let best = { error: Infinity, quality: 0, dx: coarseX, dy: coarseY };
    for (let oy = -factor; oy <= factor; oy++) {
      for (let ox = -factor; ox <= factor; ox++) {
        const x = coarseX + ox;
        const y = coarseY + oy;
        if (
          x < 0 ||
          y < 0 ||
          x + leaked.width > original.width ||
          y + leaked.height > original.height
        ) {
          continue;
        }
        const fit = agreement(original, leaked, x, y, REFINE_SAMPLES);
        if (fit.error < best.error) best = { ...fit, dx: x, dy: y };
      }
    }
    dx = best.dx;
    dy = best.dy;
  }

  const { quality } = agreement(original, leaked, dx, dy, REFINE_SAMPLES * 4);
  if (quality < ALIGN_MIN_QUALITY) {
    return {
      reason:
        'The image does not match this chart at its original size. It may be a different chart, or scaled.',
    };
  }
  return {
    alignment: { dx, dy, width: leaked.width, height: leaked.height, quality },
  };
}

function cellDifferences(original: Gray, leaked: Gray, alignment: Alignment) {
  const cols = cellColumns(original.width);
  const firstCol = Math.ceil(alignment.dx / CELL_PX);
  const lastCol = Math.floor((alignment.dx + alignment.width) / CELL_PX) - 1;
  const firstRow = Math.ceil(alignment.dy / CELL_PX);
  const lastRow = Math.floor((alignment.dy + alignment.height) / CELL_PX) - 1;

  const indexes: number[] = [];
  const diffs: number[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      let sum = 0;
      let valid = 0;
      for (let j = 0; j < CELL_PX; j++) {
        const y = row * CELL_PX + j;
        for (let i = 0; i < CELL_PX; i++) {
          const x = col * CELL_PX + i;
          if (x >= original.width || y >= original.height) continue;
          const clean = original.data[y * original.width + x];
          const diff =
            leaked.data[(y - alignment.dy) * leaked.width + x - alignment.dx] -
            clean;
          if (clean < DARK_PIXEL || Math.abs(diff) > DIFF_OUTLIER) continue;
          sum += diff;
          valid++;
        }
      }
      if (valid >= MIN_VALID_PIXELS) {
        indexes.push(row * cols + col);
        diffs.push(sum / valid);
      }
    }
  }
  return { indexes: Int32Array.from(indexes), diffs: Float32Array.from(diffs) };
}

function scoreSeed(
  seed: number,
  indexes: Int32Array,
  centered: Float32Array,
  spread: number
) {
  let sumX = 0;
  let sumSquaresX = 0;
  let sumXY = 0;
  for (let i = 0; i < indexes.length; i++) {
    const x = 0.5 - noiseValue(seed, indexes[i]);
    sumX += x;
    sumSquaresX += x * x;
    sumXY += x * centered[i];
  }
  const varianceX = sumSquaresX - (sumX * sumX) / indexes.length;
  const correlation = sumXY / Math.sqrt(varianceX * spread || 1);
  const gain = sumXY / (varianceX || 1);
  return {
    correlation,
    z: correlation * Math.sqrt(indexes.length),
    level: Math.max(0, gain / (2 * BASE_AMPLITUDE)),
  };
}

export function verdictFor(topZ: number): Verdict {
  return topZ >= MATCH_Z ? 'match' : topZ >= POSSIBLE_Z ? 'possible' : 'none';
}

export async function analyzeNative(input: {
  original: Gray;
  leaked: Gray;
  candidates: Candidate[];
  alignment: Alignment;
}): Promise<LeakAnalysis> {
  const { original, leaked, alignment } = input;

  const { indexes, diffs } = cellDifferences(original, leaked, alignment);
  if (indexes.length < MIN_CELLS) {
    return {
      aligned: false,
      reason:
        'Too little of the image is usable for noise analysis (mostly dark or heavily altered).',
    };
  }

  const prepare = (stride: number) => {
    const picked = Math.ceil(indexes.length / stride);
    const subIndexes = new Int32Array(picked);
    const values = new Float32Array(picked);
    let mean = 0;
    for (let i = 0, n = 0; i < indexes.length; i += stride, n++) {
      subIndexes[n] = indexes[i];
      values[n] = diffs[i];
      mean += diffs[i];
    }
    mean /= picked;
    let spread = 0;
    for (let n = 0; n < picked; n++) {
      values[n] -= mean;
      spread += values[n] * values[n];
    }
    return { indexes: subIndexes, centered: values, spread };
  };

  const stride = Math.max(1, Math.ceil(indexes.length / SCREEN_CELLS));
  const full = prepare(1);
  const screen = stride > 1 ? prepare(stride) : full;

  const scoreAll = async (
    users: Candidate[],
    data: ReturnType<typeof prepare>
  ) => {
    const out: CandidateScore[] = [];
    for (let i = 0; i < users.length; i++) {
      const seedKey = watermarkSeedKey(users[i].userId);
      if (seedKey) {
        const result = scoreSeed(
          seedFromKey(seedKey),
          data.indexes,
          data.centered,
          data.spread
        );
        out.push({ ...users[i], ...result });
      }
      if ((i + 1) % CANDIDATES_PER_TICK === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
    return out.sort((a, b) => b.z - a.z);
  };

  let scores = await scoreAll(input.candidates, screen);
  const tested = scores.length;
  if (stride > 1) {
    scores = await scoreAll(scores.slice(0, RESCORE_TOP), full);
  }

  const top = scores[0]?.z ?? 0;
  return {
    aligned: true,
    alignment,
    chart: { width: original.width, height: original.height },
    cells: indexes.length,
    noiseStd: Math.sqrt(full.spread / diffs.length),
    verdict: verdictFor(top),
    matches: scores.slice(0, TOP_MATCHES),
    candidatesTested: tested,
  };
}
