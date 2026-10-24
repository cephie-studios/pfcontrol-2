import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../../../server/db/connection.js', () => ({
  redisConnection: { get: vi.fn(), set: vi.fn() },
}));

import {
  generateAtis,
  generateAtisText,
} from '../../../server/utils/atisGenerator';

describe('generateAtisText', () => {
  it('matches vATCSuite for a European METAR with shared runways', () => {
    expect(
      generateAtisText({
        stationName: 'Testport',
        ident: 'A',
        metar: 'EGKK 251150Z AUTO 24012KT 9999 FEW035 BKN045 14/08 Q1012',
        landingRunways: ['26L'],
        departingRunways: ['26L'],
        remarks: 'EXPECT ILS APPROACH RUNWAY 26L',
      })
    ).toBe(
      'TESTPORT INFORMATION A...  1150Z...  WIND 240 AT 12 KNOTS...  VISIBILITY 10 OR MORE KILOMETERS...  FEW CLOUDS AT 3500, CEILING 4500 BROKEN...  TEMPERATURE 14, DEWPOINT 8...  QNH 1012, ALTIMETER 2989...  LANDING AND DEPARTING RUNWAY 26L...  EXPECT ILS APPROACH RUNWAY 26L...  ADVISE CONTROLLER ON INITIAL CONTACT THAT YOU HAVE INFORMATION A... '
    );
  });

  it('matches vATCSuite for a US METAR with gusts and split runways', () => {
    expect(
      generateAtisText({
        stationName: 'Testport',
        ident: 'A',
        metar:
          'KJFK 251851Z 31015G25KT 10SM FEW050 SCT250 18/02 A3002 RMK AO2 SLP165 T01830022',
        landingRunways: ['31R', '31L'],
        departingRunways: ['31L'],
      })
    ).toBe(
      'TESTPORT INFORMATION A...  1851Z...  WIND 310 AT 15, GUSTING 25 KNOTS...  VISIBILITY 10 OR MORE MILES...  FEW CLOUDS AT 5000, SCATTERED CLOUDS AT 25000...  TEMPERATURE 18, DEWPOINT 2...  ALTIMETER 3002, QNH 1017...  LANDING RUNWAYS 31R, 31L...  DEPARTING RUNWAY 31L...  ADVISE CONTROLLER ON INITIAL CONTACT THAT YOU HAVE INFORMATION A... '
    );
  });

  it('matches vATCSuite for low visibility, weather and negative temperatures', () => {
    expect(
      generateAtisText({
        stationName: 'Testport',
        ident: 'A',
        metar:
          'EGFF 251220Z 27002KT 1200 -RA BR SCT003 SCT010TCU BKN015 OVC030 M01/M03 Q0998',
        landingRunways: ['30'],
        departingRunways: ['30'],
      })
    ).toBe(
      'TESTPORT INFORMATION A...  1220Z...  WIND CALM...  VISIBILITY 1 KILOMETER...  LIGHT RAIN, MIST...  SCATTERED CLOUDS AT 300, SCATTERED CLOUDS AT 1000 TOWERING CUMULUS, CEILING 1500 BROKEN, OVERCAST SKY AT 3000...  TEMPERATURE MINUS 1, DEWPOINT MINUS 3...  QNH 0998, ALTIMETER 2947...  LANDING AND DEPARTING RUNWAY 30...  ADVISE CONTROLLER ON INITIAL CONTACT THAT YOU HAVE INFORMATION A... '
    );
  });

  it('ignores weather in trend groups after the pressure', () => {
    const text = generateAtisText({
      stationName: 'Testport',
      ident: 'A',
      metar: 'EGKK 251150Z 24012KT 9999 FEW035 14/08 Q1012 TEMPO 4000 -SHRA',
      landingRunways: ['26L'],
      departingRunways: ['26L'],
    });
    expect(text).not.toContain('RAIN SHOWERS');
  });
});

describe('generateAtis', () => {
  it('uses the airport control name and a supplied METAR', async () => {
    const text = await generateAtis({
      icao: 'egkk',
      ident: 'b',
      metar: 'EGKK 251150Z 24012KT CAVOK 14/08 Q1012',
      landingRunways: ['26L'],
      departingRunways: ['26L'],
    });
    expect(text.startsWith('GATWICK INFORMATION B... ')).toBe(true);
  });

  it('rejects an invalid ident', async () => {
    await expect(
      generateAtis({
        icao: 'EGKK',
        ident: '1',
        metar: 'EGKK 251150Z 24012KT CAVOK 14/08 Q1012',
        landingRunways: [],
        departingRunways: [],
      })
    ).rejects.toThrow('ATIS identifier');
  });
});
