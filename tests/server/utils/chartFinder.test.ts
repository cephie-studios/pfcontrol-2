import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { findChart } from '../../../server/utils/chartFinder.js';
import {
  buildVocabulary,
  type ChartRef,
} from '../../../server/utils/chartIdentify.js';
import {
  watermarkIdentity,
  watermarkPlate,
} from '../../../server/utils/chartWatermark.js';

const WIDTH = 1500;
const HEIGHT = 1100;

function chartSvg(seedStart: number) {
  let seed = seedStart;
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const parts: string[] = [];
  for (let i = 0; i < 90; i++) {
    const x = Math.round(next() * WIDTH);
    const y = Math.round(next() * HEIGHT);
    parts.push(
      `<line x1="${x}" y1="${y}" x2="${Math.round(next() * WIDTH)}" y2="${Math.round(next() * HEIGHT)}" stroke="black" stroke-width="${1 + Math.round(next() * 3)}"/>`,
      `<circle cx="${x}" cy="${y}" r="${10 + Math.round(next() * 40)}" fill="none" stroke="black" stroke-width="2"/>`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><rect width="100%" height="100%" fill="white"/>${parts.join('')}</svg>`;
}

const refs: ChartRef[] = [
  { icao: 'AAAA', kind: 'one', name: 'Chart one' },
  { icao: 'BBBB', kind: 'two', name: 'Chart two' },
  { icao: 'CCCC', kind: 'three', name: 'Chart three' },
];

describe('findChart', () => {
  const plates = new Map<string, Buffer>();
  const vocabulary = buildVocabulary(
    {
      AAAA: [{ kind: 'one', name: 'Chart one' }],
      BBBB: [{ kind: 'two', name: 'Chart two' }],
      CCCC: [{ kind: 'three', name: 'Chart three' }],
    },
    []
  );
  const fetchOriginal = async (chart: ChartRef) =>
    plates.get(`${chart.icao}/${chart.kind}`) ?? null;
  const readText = async () => [] as string[];

  beforeAll(async () => {
    for (const [index, ref] of refs.entries()) {
      plates.set(
        `${ref.icao}/${ref.kind}`,
        await sharp(Buffer.from(chartSvg(7 + index * 101)))
          .webp({ lossless: true })
          .toBuffer()
      );
    }
  });

  const markedTwo = async () =>
    watermarkPlate(
      plates.get('BBBB/two')!,
      watermarkIdentity('1000000000000000009', 'someone')!
    );

  it('finds the chart from a full copy without being told the airport', async () => {
    const result = await findChart({
      version: 'full-copy',
      charts: refs,
      vocabulary,
      leaked: await markedTwo(),
      fetchOriginal,
      readText,
    });
    expect(result.found?.chart).toMatchObject({ icao: 'BBBB', kind: 'two' });
    expect(result.found?.via).toBe('appearance');
    expect(result.alternatives).toEqual([]);
  });

  it('finds the chart and the position from a crop', async () => {
    const leaked = await sharp(await markedTwo())
      .extract({ left: 420, top: 233, width: 600, height: 500 })
      .png()
      .toBuffer();
    const result = await findChart({
      version: 'cropped-copy',
      charts: refs,
      vocabulary,
      leaked,
      fetchOriginal,
      readText,
    });
    expect(result.found?.chart.kind).toBe('two');
    expect(result.found?.preAligned).toMatchObject({
      mode: 'native',
      alignment: { dx: 420, dy: 233 },
    });
  });

  it('gives up on an image that is not any known chart', async () => {
    const stranger = await sharp(Buffer.from(chartSvg(99991)))
      .png()
      .toBuffer();
    const result = await findChart({
      version: 'stranger-image',
      charts: refs,
      vocabulary,
      leaked: stranger,
      fetchOriginal,
      readText,
    });
    expect(result.found).toBeNull();
  });
});
