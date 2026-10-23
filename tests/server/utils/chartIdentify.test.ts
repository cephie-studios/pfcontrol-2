import { describe, expect, it } from 'vitest';
import {
  buildVocabulary,
  candidateCharts,
  rankCharts,
} from '../../../server/utils/chartIdentify.js';

const index = {
  EGKK: [
    { kind: 'diagram', name: 'Airport Diagram', category: 'ground' },
    {
      kind: 'sid-bogna1x',
      name: 'SID BOGNA 1X',
      category: 'sid',
      procedures: ['BOGNA1X'],
      runways: ['26L'],
    },
  ],
  EGFF: [
    {
      kind: 'star-tojaq2c',
      name: 'STAR TOJAQ 2C',
      category: 'star',
      procedures: ['TOJAQ2C'],
    },
  ],
};

const airports = [
  {
    icao: 'EGKK',
    name: 'London Gatwick International Airport',
    runways: ['26L', '08R'],
    allFrequencies: { TWR: '124.230' },
    sidWaypoints: { BOGNA1X: ['KKWO6', 'BOGNA'] },
  },
  { icao: 'EGFF', name: 'Cardiff Airport', runways: ['12', '30'] },
];

describe('chart identification by text', () => {
  const vocabulary = buildVocabulary(index, airports);

  it('ranks the chart whose procedure and waypoints were read', () => {
    const ranked = rankCharts(['BOGNA1X', 'KKWO6', '26L'], vocabulary);
    expect(ranked[0].chart).toMatchObject({
      icao: 'EGKK',
      kind: 'sid-bogna1x',
    });
    expect(ranked[0].matched).toEqual(
      expect.arrayContaining(['BOGNA1X', 'KKWO6', '26L'])
    );
  });

  it('uses the airport name, runways and frequencies', () => {
    const ranked = rankCharts(['CARDIFF', '30'], vocabulary);
    expect(ranked[0].chart.icao).toBe('EGFF');
    const byFrequency = rankCharts(['124.230'], vocabulary);
    expect(byFrequency[0].chart.icao).toBe('EGKK');
  });

  it('weighs a rare word above a common one', () => {
    const common = rankCharts(['AIRPORT'], vocabulary)[0].score;
    const rare = rankCharts(['TOJAQ2C'], vocabulary)[0].score;
    expect(rare).toBeGreaterThan(common);
  });

  it('tolerates the characters a reader confuses', () => {
    const ranked = rankCharts(['B0GNATX'], vocabulary);
    expect(ranked[0].chart.kind).toBe('sid-bogna1x');
    expect(ranked[0].matched).toContain('BOGNA1X');
  });

  it('ignores text that is on no chart', () => {
    expect(rankCharts(['ZZZZ', 'NOTHING'], vocabulary)).toEqual([]);
  });

  it('limits candidates to the likeliest airports', () => {
    const ranked = rankCharts(
      ['EGKK', 'BOGNA1X', 'TOJAQ2C', 'EGFF'],
      vocabulary
    );
    expect(candidateCharts(ranked, 2)).toHaveLength(2);
    expect(candidateCharts([], 5)).toEqual([]);
  });
});
