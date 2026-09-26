import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  densify,
  forecastDailySeries,
} from '../../../server/utils/dailyForecast';

// 2026-09-26 is a Saturday.
const LAST = '2026-09-26';

function series(days: number, fn: (i: number, weekday: number) => number) {
  return Array.from({ length: days }, (_, i) => {
    const key = addDaysToKey(LAST, i - (days - 1));
    return fn(i, new Date(`${key}T00:00:00Z`).getUTCDay());
  });
}

describe('forecastDailySeries', () => {
  it('stays flat for a flat series', () => {
    const f = forecastDailySeries(
      series(56, () => 100),
      LAST,
      30
    );
    expect(f.weeklyGrowthPct).toBe(0);
    expect(f.peakWeekday).toBeNull();
    for (const p of f.points) expect(p.value).toBeCloseTo(100, 5);
  });

  it('picks up weekly growth and keeps it damped', () => {
    const f = forecastDailySeries(
      series(56, (i) => 100 * 1.1 ** (i / 7)),
      LAST,
      30
    );
    expect(f.weeklyGrowthPct).toBeGreaterThan(8);
    expect(f.weeklyGrowthPct).toBeLessThan(12);
    const first = f.points[0].value;
    const last = f.points[29].value;
    expect(last).toBeGreaterThan(first);
    // Undamped 10%/week over 30 days would be ~1.5x.
    expect(last / first).toBeLessThan(1.5);
  });

  it('learns a weekday pattern', () => {
    const f = forecastDailySeries(
      series(56, (_i, wd) => (wd === 6 ? 300 : 100)),
      LAST,
      14
    );
    expect(f.peakWeekday).toBe('Saturday');
    const sat = f.points.find(
      (p) => new Date(`${p.date}T00:00:00Z`).getUTCDay() === 6
    )!;
    const mon = f.points.find(
      (p) => new Date(`${p.date}T00:00:00Z`).getUTCDay() === 1
    )!;
    expect(sat.value).toBeGreaterThan(mon.value * 2);
  });

  it('ignores a single outlier week for the trend', () => {
    const f = forecastDailySeries(
      series(56, (i) => (i >= 21 && i < 28 ? 1000 : 100)),
      LAST,
      30
    );
    expect(Math.abs(f.weeklyGrowthPct)).toBeLessThan(1);
  });

  it('handles missing days and short history', () => {
    const sparse = densify(new Map([[LAST, 10]]), LAST, 56);
    const f = forecastDailySeries(sparse, LAST, 7);
    expect(f.points).toHaveLength(7);
    expect(f.weeklyGrowthPct).toBe(0);
    for (const p of f.points) {
      expect(Number.isFinite(p.value)).toBe(true);
      expect(p.low).toBeLessThanOrEqual(p.value);
      expect(p.high).toBeGreaterThanOrEqual(p.value);
    }
  });
});
