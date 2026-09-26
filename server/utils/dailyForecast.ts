const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WEEKLY_LOG_GROWTH = 0.2;
const DAMPING = 0.98;
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export type ForecastPoint = {
  date: string;
  value: number;
  low: number;
  high: number;
};

export type SeriesForecast = {
  level: number;
  weeklyGrowthPct: number;
  weeklyGrowthLowPct: number;
  weeklyGrowthHighPct: number;
  weekdayFactors: number[];
  peakWeekday: string | null;
  peakFactor: number;
  points: ForecastPoint[];
};

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysToKey(key: string, days: number): string {
  return dateKey(new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS));
}

function weekdayOf(key: string): number {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

function mean(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function densify(
  values: Map<string, number>,
  lastDate: string,
  days: number,
  missing: number | null = null
): Array<number | null> {
  const out: Array<number | null> = [];
  for (let i = days - 1; i >= 0; i--) {
    const v = values.get(addDaysToKey(lastDate, -i));
    out.push(v === undefined ? missing : v);
  }
  return out;
}

function weekdayFactors(
  history: Array<number | null>,
  lastDate: string
): number[] {
  const buckets: number[][] = [[], [], [], [], [], [], []];
  history.forEach((v, i) => {
    if (v === null) return;
    const key = addDaysToKey(lastDate, i - (history.length - 1));
    buckets[weekdayOf(key)].push(v);
  });

  const minCount = Math.min(...buckets.map((b) => b.length));
  const means = buckets.map(mean);
  const overall = mean(means);
  if (minCount < 2 || overall <= 0) return [1, 1, 1, 1, 1, 1, 1];

  const weight = minCount / (minCount + 1);
  const raw = means.map((m) => clamp(1 + (m / overall - 1) * weight, 0.25, 3));
  const norm = mean(raw);
  return raw.map((f) => f / norm);
}

export function forecastDailySeries(
  history: Array<number | null>,
  lastDate: string,
  horizon: number
): SeriesForecast {
  const factors = weekdayFactors(history, lastDate);

  const weeks: Array<{ index: number; perDay: number }> = [];
  const blockCount = Math.floor(history.length / 7);
  for (let b = 0; b < blockCount; b++) {
    const end = history.length - b * 7;
    const block = history
      .slice(end - 7, end)
      .filter((v): v is number => v !== null);
    if (block.length >= 4) {
      weeks.push({ index: blockCount - 1 - b, perDay: mean(block) });
    }
  }
  weeks.sort((a, b) => a.index - b.index);

  let growth = 0;
  let growthLow = 0;
  let growthHigh = 0;
  if (weeks.length >= 3) {
    const slopes: number[] = [];
    for (let i = 0; i < weeks.length; i++) {
      for (let j = i + 1; j < weeks.length; j++) {
        slopes.push(
          (Math.log(weeks[j].perDay + 1) - Math.log(weeks[i].perDay + 1)) /
            (weeks[j].index - weeks[i].index)
        );
      }
    }
    slopes.sort((a, b) => a - b);
    const bound = (v: number) =>
      clamp(v, -MAX_WEEKLY_LOG_GROWTH, MAX_WEEKLY_LOG_GROWTH);
    growth = bound(quantile(slopes, 0.5));
    growthLow = Math.min(growth, bound(quantile(slopes, 0.2)));
    growthHigh = Math.max(growth, bound(quantile(slopes, 0.8)));
  }

  const known = history.filter((v): v is number => v !== null);
  const latestWeek = weeks.find((w) => w.index === blockCount - 1);
  const baseLevel = latestWeek?.perDay ?? mean(known.slice(-7));
  const level = Math.max(0, baseLevel * Math.exp((growth / 7) * 3));

  const points: ForecastPoint[] = [];
  let damped = 0;
  for (let t = 1; t <= horizon; t++) {
    damped += DAMPING ** t;
    const date = addDaysToKey(lastDate, t);
    const f = factors[weekdayOf(date)];
    const at = (g: number) => level * Math.exp((g / 7) * damped) * f;
    points.push({
      date,
      value: at(growth),
      low: at(growthLow),
      high: at(growthHigh),
    });
  }

  const peakIndex = factors.indexOf(Math.max(...factors));
  const hasPattern = factors.some((f) => Math.abs(f - 1) > 0.05);

  const pct = (g: number) => Math.round((Math.exp(g) - 1) * 1000) / 10;
  return {
    level,
    weeklyGrowthPct: pct(growth),
    weeklyGrowthLowPct: pct(growthLow),
    weeklyGrowthHighPct: pct(growthHigh),
    weekdayFactors: factors,
    peakWeekday: hasPattern ? WEEKDAY_NAMES[peakIndex] : null,
    peakFactor: Math.round(factors[peakIndex] * 100) / 100,
    points,
  };
}
