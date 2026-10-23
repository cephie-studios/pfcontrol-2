import {
  alignToOriginal,
  analyzeNative,
  loadGray,
  verdictFor,
  type Alignment,
  type Candidate,
  type CandidateScore,
  type LeakAnalysis,
} from './chartForensics.js';
import {
  alignScaled,
  rankScaled,
  type ScaledAlignment,
} from './chartScaled.js';

const TOP_MATCHES = 10;

export type PreAligned =
  | { mode: 'native'; alignment: Alignment }
  | { mode: 'scaled'; alignment: ScaledAlignment };

function visibleRegion(
  alignment: ScaledAlignment,
  leaked: { width: number; height: number },
  chart: { width: number; height: number }
): Alignment {
  const { scale, tx, ty, quality } = alignment;
  const x0 = Math.max(0, -tx / scale);
  const y0 = Math.max(0, -ty / scale);
  const x1 = Math.min(chart.width, (leaked.width - tx) / scale);
  const y1 = Math.min(chart.height, (leaked.height - ty) / scale);
  return {
    dx: Math.round(x0),
    dy: Math.round(y0),
    width: Math.max(1, Math.round(x1 - x0)),
    height: Math.max(1, Math.round(y1 - y0)),
    quality,
    scale,
  };
}

export async function analyzeLeak(input: {
  leaked: Buffer;
  original: Buffer;
  candidates: Candidate[];
  preAligned?: PreAligned;
}): Promise<LeakAnalysis> {
  const [original, leaked] = await Promise.all([
    loadGray(input.original),
    loadGray(input.leaked),
  ]);
  const base = { original, leaked, candidates: input.candidates };

  if (input.preAligned?.mode === 'native') {
    return analyzeNative({ ...base, alignment: input.preAligned.alignment });
  }

  let scaled: ScaledAlignment | null = null;
  if (input.preAligned?.mode === 'scaled') {
    scaled = input.preAligned.alignment;
  } else {
    const native = alignToOriginal(original, leaked);
    if ('alignment' in native) {
      return analyzeNative({ ...base, alignment: native.alignment });
    }
    scaled = (await alignScaled(original, leaked))?.alignment ?? null;
    if (!scaled) return { aligned: false, reason: native.reason };
  }

  const ranking = await rankScaled(original, leaked, scaled, input.candidates);
  if (!ranking) {
    return {
      aligned: false,
      reason:
        'Too little of the scaled image is usable for noise analysis (mostly dark or detailed).',
    };
  }
  const matches: CandidateScore[] = ranking.ranked
    .slice(0, TOP_MATCHES)
    .map(({ userId, username, score }) => ({
      userId,
      username,
      z: score.z,
      correlation: score.correlation,
      level: score.level,
    }));
  return {
    aligned: true,
    alignment: visibleRegion(scaled, leaked, original),
    chart: { width: original.width, height: original.height },
    cells: ranking.points,
    noiseStd: ranking.noiseStd,
    verdict: verdictFor(matches[0]?.z ?? 0),
    matches,
    candidatesTested: ranking.tested,
  };
}
