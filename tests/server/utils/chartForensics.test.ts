import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeLeak } from '../../../server/utils/chartAnalysis.js';
import {
  watermarkIdentity,
  watermarkPlate,
} from '../../../server/utils/chartWatermark.js';

const WIDTH = 1500;
const HEIGHT = 1100;

const alice = { userId: '1000000000000000001', username: 'alice' };
const bob = { userId: '1000000000000000002', username: 'bob' };
const carol = { userId: '1000000000000000003', username: 'carol' };

function chartSvg() {
  let seed = 7;
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const parts: string[] = [];
  for (let i = 0; i < 90; i++) {
    const x = Math.round(next() * WIDTH);
    const y = Math.round(next() * HEIGHT);
    parts.push(
      `<line x1="${x}" y1="${y}" x2="${Math.round(next() * WIDTH)}" y2="${Math.round(next() * HEIGHT)}" stroke="black" stroke-width="${1 + Math.round(next() * 3)}"/>`,
      `<circle cx="${x}" cy="${y}" r="${10 + Math.round(next() * 40)}" fill="none" stroke="black" stroke-width="2"/>`,
      `<text x="${x}" y="${y}" font-size="${14 + Math.round(next() * 16)}" fill="black">WPT${i}</text>`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><rect width="100%" height="100%" fill="white"/>${parts.join('')}</svg>`;
}

const identityFor = (user: { userId: string; username: string }) =>
  watermarkIdentity(user.userId, user.username)!;

describe('analyzeLeak', () => {
  let original: Buffer;
  let marked: Buffer;

  beforeAll(async () => {
    original = await sharp(Buffer.from(chartSvg()))
      .webp({ lossless: true })
      .toBuffer();
    marked = await watermarkPlate(original, identityFor(alice));
  });

  it('identifies the viewer from a full-size copy', async () => {
    const result = await analyzeLeak({
      leaked: marked,
      original,
      candidates: [bob, alice, carol],
    });
    expect(result.aligned).toBe(true);
    if (!result.aligned) return;
    expect(result.verdict).toBe('match');
    expect(result.matches[0].userId).toBe(alice.userId);
    expect(result.matches[0].z).toBeGreaterThan(8);
    expect(Math.abs(result.matches[1].z)).toBeLessThan(5);
    expect(result.alignment).toMatchObject({ dx: 0, dy: 0 });
  });

  it('identifies the viewer from a cropped copy', async () => {
    const leaked = await sharp(marked)
      .extract({ left: 301, top: 157, width: 700, height: 500 })
      .png()
      .toBuffer();
    const result = await analyzeLeak({
      leaked,
      original,
      candidates: [bob, carol, alice],
    });
    expect(result.aligned).toBe(true);
    if (!result.aligned) return;
    expect(result.alignment).toMatchObject({ dx: 301, dy: 157 });
    expect(result.verdict).toBe('match');
    expect(result.matches[0].userId).toBe(alice.userId);
  });

  it('still finds the viewer after they change their username', async () => {
    const renamed = { ...alice, username: 'alice the second' };
    const result = await analyzeLeak({
      leaked: marked,
      original,
      candidates: [bob, renamed],
    });
    expect(result.aligned && result.matches[0].userId).toBe(alice.userId);
  });

  it('does not accuse anyone when the viewer is not a candidate', async () => {
    const result = await analyzeLeak({
      leaked: marked,
      original,
      candidates: [bob, carol],
    });
    expect(result.aligned).toBe(true);
    if (!result.aligned) return;
    expect(result.verdict).toBe('none');
  });

  it('reports no watermark on the clean chart', async () => {
    const result = await analyzeLeak({
      leaked: original,
      original,
      candidates: [alice, bob, carol],
    });
    expect(result.aligned && result.verdict).toBe('none');
  });

  it('identifies the viewer from a resized screenshot with margins', async () => {
    const resized = await sharp(marked)
      .resize(Math.round(WIDTH * 0.6))
      .png()
      .toBuffer();
    const meta = await sharp(resized).metadata();
    const leaked = await sharp({
      create: {
        width: meta.width! + 60,
        height: meta.height! + 40,
        channels: 3,
        background: '#ffffff',
      },
    })
      .composite([{ input: resized, left: 24, top: 16 }])
      .png()
      .toBuffer();
    const result = await analyzeLeak({
      leaked,
      original,
      candidates: [bob, alice, carol],
    });
    expect(result.aligned).toBe(true);
    if (!result.aligned) return;
    expect(result.alignment.scale).toBeCloseTo(0.6, 2);
    expect(result.verdict).toBe('match');
    expect(result.matches[0].userId).toBe(alice.userId);
  }, 60_000);

  it('explains when the image is not this chart', async () => {
    const other = await sharp({
      create: {
        width: 700,
        height: 500,
        channels: 3,
        background: { r: 120, g: 30, b: 200 },
      },
    })
      .png()
      .toBuffer();
    const result = await analyzeLeak({
      leaked: other,
      original,
      candidates: [alice],
    });
    expect(result.aligned).toBe(false);
  });
});
