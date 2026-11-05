import { createElement } from 'react';
import satori from 'satori';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { getInterFontsForSatori } from '../../../server/og/loadInterFonts.js';
import {
  normalizeToken,
  readChartText,
} from '../../../server/utils/chartOcr.js';

async function textImage(lines: string[]) {
  const svg = await satori(
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
          width: 1400,
          height: 700,
          padding: 60,
          background: 'white',
          color: 'black',
          fontSize: 64,
          fontWeight: 700,
        },
      },
      ...lines.map((line, index) => createElement('div', { key: index }, line))
    ),
    { width: 1400, height: 700, fonts: await getInterFontsForSatori() }
  );
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe('normalizeToken', () => {
  it('keeps letters, digits and the punctuation charts use', () => {
    expect(normalizeToken('bogna1x,')).toBe('BOGNA1X');
    expect(normalizeToken('121.540')).toBe('121.540');
    expect(normalizeToken('(26L)')).toBe('26L');
  });
});

describe('readChartText', () => {
  it('reads the words printed on a chart', async () => {
    const image = await textImage(['EGKK GATWICK', 'SID BOGNA1X RWY 26L']);
    const words = await readChartText(image);
    expect(words).toContain('EGKK');
    expect(words.some((word) => word.startsWith('BOGNA'))).toBe(true);
  }, 30_000);

  it('returns nothing for a blank image', async () => {
    const blank = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    expect(await readChartText(blank)).toEqual([]);
  }, 30_000);
});
