import sharp from 'sharp';
import {
  BASE_AMPLITUDE,
  CELL_PX,
  cellColumns,
  noiseValue,
  seedFromKey,
  watermarkSeedKey,
} from './chartWatermark.js';
import {
  downsample,
  nccSearch,
  type Gray,
  type Grid,
} from './chartForensics.js';

const COARSE_PX = 32;
const SCALE_MIN = 0.12;
const SCALE_MAX = 3.5;
const SCALE_STEP = 1.04;
const MIN_TEMPLATE_SIDE = 12;
const MARGIN_FRACTION = 0.12;
const COARSE_ACCEPT = 0.35;
const REFINE_SPAN = 0.03;
const REFINE_STEP = 0.0025;
const FINE_SPAN = 0.004;
const OFFSET_SEARCH = 4;
const OFFSET_COARSE_FRACTION = 0.75;
const NCC_SAMPLES = 25_000;
const ACCEPT_QUALITY = 0.7;
const MIN_OVERLAP = 0.3;
const FLAT_GRADIENT = 3;
const MIN_BRIGHTNESS = 120;
const MAX_DIFF = 10;
const SCREEN_POINTS = 30_000;
const FULL_POINTS = 160_000;
const RESCORE_TOP = 25;
const TAPS = 2;
const MIN_POINTS = 2_000;

export interface ScaledAlignment {
  scale: number;
  tx: number;
  ty: number;
  quality: number;
}

export interface ScaledScore {
  z: number;
  correlation: number;
  level: number;
}

async function resizeGray(gray: Gray, width: number): Promise<Gray> {
  const { data, info } = await sharp(Buffer.from(gray.data), {
    raw: { width: gray.width, height: gray.height, channels: 1 },
  })
    .resize(width)
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function resizeToGrid(
  gray: Gray,
  width: number,
  height: number
): Promise<Grid> {
  return sharp(Buffer.from(gray.data), {
    raw: { width: gray.width, height: gray.height, channels: 1 },
  })
    .resize(width, height, { fit: 'fill' })
    .extractChannel(0)
    .raw()
    .toBuffer()
    .then((data) => ({ data: Float32Array.from(data), width, height }));
}

function padded(grid: Grid, padX: number, padY: number): Grid {
  const width = grid.width + padX * 2;
  const height = grid.height + padY * 2;
  const data = new Float32Array(width * height).fill(255);
  for (let y = 0; y < grid.height; y++) {
    data.set(
      grid.data.subarray(y * grid.width, (y + 1) * grid.width),
      (y + padY) * width + padX
    );
  }
  return { data, width, height };
}

function correlation(
  leaked: Gray,
  reference: Gray,
  tx: number,
  ty: number,
  samples: number
) {
  const x0 = Math.max(0, tx);
  const y0 = Math.max(0, ty);
  const x1 = Math.min(leaked.width, tx + reference.width);
  const y1 = Math.min(leaked.height, ty + reference.height);
  if (x1 <= x0 || y1 <= y0) return -1;
  if ((x1 - x0) * (y1 - y0) < MIN_OVERLAP * leaked.width * leaked.height) {
    return -1;
  }
  const step = Math.max(
    1,
    Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / samples))
  );
  let n = 0;
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const a = leaked.data[y * leaked.width + x];
      const b = reference.data[(y - ty) * reference.width + x - tx];
      n++;
      sa += a;
      sb += b;
      saa += a * a;
      sbb += b * b;
      sab += a * b;
    }
  }
  const varianceA = saa - (sa * sa) / n;
  const varianceB = sbb - (sb * sb) / n;
  if (varianceA < 1 || varianceB < 1) return -1;
  return (sab - (sa * sb) / n) / Math.sqrt(varianceA * varianceB);
}

export async function coarseCandidates(original: Gray, leaked: Gray) {
  const coarse = downsample(original, COARSE_PX);
  const found: {
    score: number;
    significance: number;
    scale: number;
    x: number;
    y: number;
  }[] = [];

  for (let scale = SCALE_MIN; scale <= SCALE_MAX; scale *= SCALE_STEP) {
    const width = Math.round(leaked.width / (COARSE_PX * scale));
    const height = Math.round(leaked.height / (COARSE_PX * scale));
    if (width < MIN_TEMPLATE_SIDE || height < MIN_TEMPLATE_SIDE) continue;
    const padX = Math.ceil(width * MARGIN_FRACTION);
    const padY = Math.ceil(height * MARGIN_FRACTION);
    if (width > coarse.width + padX * 2 || height > coarse.height + padY * 2) {
      continue;
    }
    const template = await resizeToGrid(leaked, width, height);
    const best = nccSearch(padded(coarse, padX, padY), template);
    if (best && best.score >= COARSE_ACCEPT) {
      found.push({
        score: best.score,
        significance: best.score * Math.sqrt(width * height),
        scale,
        x: (best.x - padX) * COARSE_PX,
        y: (best.y - padY) * COARSE_PX,
      });
    }
  }
  return found.sort((a, b) => b.significance - a.significance).slice(0, 3);
}

async function bestOffsets(
  leaked: Gray,
  reference: Gray,
  around: { tx: number; ty: number },
  radius: number
) {
  const search = (
    centre: { tx: number; ty: number },
    span: number,
    step: number
  ) => {
    let best = { quality: -1, tx: centre.tx, ty: centre.ty };
    for (let dy = -span; dy <= span; dy += step) {
      for (let dx = -span; dx <= span; dx += step) {
        const quality = correlation(
          leaked,
          reference,
          centre.tx + dx,
          centre.ty + dy,
          NCC_SAMPLES
        );
        if (quality > best.quality) {
          best = { quality, tx: centre.tx + dx, ty: centre.ty + dy };
        }
      }
    }
    return best;
  };
  if (radius <= 3) return search(around, radius, 1);
  const rough = search(around, radius, 2);
  return search(rough, 2, 1);
}

export async function alignScaled(
  original: Gray,
  leaked: Gray
): Promise<{ alignment: ScaledAlignment; coarseScore: number } | null> {
  const candidates = await coarseCandidates(original, leaked);
  let best: { alignment: ScaledAlignment; coarseScore: number } | null = null;

  for (const candidate of candidates.slice(0, 2)) {
    let local = { quality: -1, scale: candidate.scale, tx: 0, ty: 0 };

    const trial = async (
      width: number,
      radius: number,
      from?: typeof local
    ) => {
      const reference = await resizeGray(original, width);
      const scale = reference.width / original.width;
      const around = from
        ? { tx: from.tx, ty: from.ty }
        : {
            tx: Math.round(-candidate.x * scale),
            ty: Math.round(-candidate.y * scale),
          };
      const result = await bestOffsets(leaked, reference, around, radius);
      if (result.quality > local.quality) {
        local = {
          quality: result.quality,
          scale,
          tx: result.tx,
          ty: result.ty,
        };
      }
    };

    const baseWidth = original.width * candidate.scale;
    const offsetRadius =
      Math.ceil(OFFSET_COARSE_FRACTION * COARSE_PX * candidate.scale) +
      OFFSET_SEARCH;
    const spanPx = Math.round(baseWidth * REFINE_SPAN);
    const stepPx = Math.max(1, Math.round(baseWidth * REFINE_STEP));
    for (let delta = -spanPx; delta <= spanPx; delta += stepPx) {
      await trial(Math.round(baseWidth + delta), offsetRadius);
    }
    const centre = Math.round(local.scale * original.width);
    const finePx = Math.max(2, Math.round(centre * FINE_SPAN));
    const start = { ...local };
    for (let delta = -finePx; delta <= finePx; delta++) {
      await trial(centre + delta, 2, start);
    }

    if (
      local.quality >= ACCEPT_QUALITY &&
      (!best || local.quality > best.alignment.quality)
    ) {
      best = {
        alignment: {
          scale: local.scale,
          tx: local.tx,
          ty: local.ty,
          quality: local.quality,
        },
        coarseScore: candidate.score,
      };
    }
  }
  return best;
}

export async function scaledFootprint(
  original: Gray,
  leaked: Gray,
  alignment: ScaledAlignment
) {
  const reference = await resizeGray(
    original,
    Math.round(original.width * alignment.scale)
  );
  const { tx, ty } = alignment;
  const x0 = Math.max(2, tx + 2);
  const y0 = Math.max(2, ty + 2);
  const x1 = Math.min(leaked.width - 2, tx + reference.width - 2);
  const y1 = Math.min(leaked.height - 2, ty + reference.height - 2);

  const points: { u: number; v: number; diff: number }[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const rx = x - tx;
      const ry = y - ty;
      const i = ry * reference.width + rx;
      const value = reference.data[i];
      const gradient =
        Math.abs(reference.data[i + 1] - reference.data[i - 1]) +
        Math.abs(
          reference.data[i + reference.width] -
            reference.data[i - reference.width]
        );
      if (gradient >= FLAT_GRADIENT || value < MIN_BRIGHTNESS) continue;
      const diff = leaked.data[y * leaked.width + x] - value;
      if (Math.abs(diff) > MAX_DIFF) continue;
      points.push({ u: rx, v: ry, diff });
    }
  }
  const effective = reference.width / original.width;
  return { points, scale: effective, chart: { width: original.width } };
}

export interface FootprintPoints {
  u: Float32Array;
  v: Float32Array;
  diff: Float32Array;
}

export function sampleFootprint(
  points: { u: number; v: number; diff: number }[],
  limit: number
): FootprintPoints | null {
  if (points.length < MIN_POINTS) return null;
  const step = Math.max(1, Math.floor(points.length / limit));
  const picked = Math.ceil(points.length / step);
  const sampled = {
    u: new Float32Array(picked),
    v: new Float32Array(picked),
    diff: new Float32Array(picked),
  };
  for (let i = 0, n = 0; i < points.length; i += step, n++) {
    sampled.u[n] = points[i].u;
    sampled.v[n] = points[i].v;
    sampled.diff[n] = points[i].diff;
  }
  return sampled;
}

export function scoreScaled(
  seedKey: string,
  sample: FootprintPoints,
  scale: number,
  chartWidth: number
): ScaledScore {
  const seed = seedFromKey(seedKey);
  const cols = cellColumns(chartWidth);
  const count = sample.u.length;
  const model = new Float32Array(count);
  let sumX = 0;
  let sumXX = 0;
  let sumY = 0;
  let sumYY = 0;
  let sumXY = 0;

  for (let k = 0; k < count; k++) {
    let acc = 0;
    for (let j = 0; j < TAPS; j++) {
      for (let i = 0; i < TAPS; i++) {
        const nx = (sample.u[k] + (i + 0.5) / TAPS) / scale;
        const ny = (sample.v[k] + (j + 0.5) / TAPS) / scale;
        const col = Math.min(cols - 1, Math.floor(nx / CELL_PX));
        acc += 0.5 - noiseValue(seed, Math.floor(ny / CELL_PX) * cols + col);
      }
    }
    const x = acc / (TAPS * TAPS);
    const y = sample.diff[k];
    model[k] = x;
    sumX += x;
    sumXX += x * x;
    sumY += y;
    sumYY += y * y;
    sumXY += x * y;
  }

  const varianceX = sumXX - (sumX * sumX) / count;
  const varianceY = sumYY - (sumY * sumY) / count;
  const covariance = sumXY - (sumX * sumY) / count;
  const corr = covariance / Math.sqrt(varianceX * varianceY || 1);
  const independent = count / Math.max(1, (CELL_PX * scale) ** 2);
  return {
    correlation: corr,
    z: corr * Math.sqrt(independent),
    level: Math.max(0, covariance / (varianceX || 1) / (2 * BASE_AMPLITUDE)),
  };
}

export async function rankScaled(
  original: Gray,
  leaked: Gray,
  alignment: ScaledAlignment,
  candidates: { userId: string; username: string }[]
) {
  const footprint = await scaledFootprint(original, leaked, alignment);
  const screen = sampleFootprint(footprint.points, SCREEN_POINTS);
  if (!screen) return null;
  const full = sampleFootprint(footprint.points, FULL_POINTS) ?? screen;

  const first: { userId: string; username: string; score: ScaledScore }[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const seedKey = watermarkSeedKey(candidates[i].userId);
    if (seedKey) {
      first.push({
        ...candidates[i],
        score: scoreScaled(
          seedKey,
          screen,
          footprint.scale,
          footprint.chart.width
        ),
      });
    }
    if ((i + 1) % 20 === 0)
      await new Promise((resolve) => setImmediate(resolve));
  }
  first.sort((a, b) => b.score.z - a.score.z);
  const tested = first.length;

  const rescored = first.slice(0, RESCORE_TOP).map((entry) => ({
    ...entry,
    score: scoreScaled(
      watermarkSeedKey(entry.userId)!,
      full,
      footprint.scale,
      footprint.chart.width
    ),
  }));
  rescored.sort((a, b) => b.score.z - a.score.z);
  let spread = 0;
  for (const point of footprint.points) spread += point.diff * point.diff;
  return {
    ranked: rescored,
    tested,
    points: footprint.points.length,
    noiseStd: Math.sqrt(spread / footprint.points.length),
  };
}
