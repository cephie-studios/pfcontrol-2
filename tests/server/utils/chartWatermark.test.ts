import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  watermarkIdentity,
  watermarkPlate,
} from '../../../server/utils/chartWatermark.js';

async function whitePlate(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .webp({ lossless: true })
    .toBuffer();
}

const identity = (userId: string, username = 'someone') =>
  watermarkIdentity(userId, username)!;

describe('watermarkIdentity', () => {
  it('names the viewer with a stable code and their Discord ID', () => {
    const { label } = identity('123', 'Some Pilot');
    expect(label).toMatch(/^Some Pilot {4}[0-9a-f]{8} {4}123$/);
    expect(identity('123', 'Some Pilot').label).toBe(label);
  });

  it('keeps the same seed when the username changes', () => {
    expect(identity('123', 'old name').seedKey).toBe(
      identity('123', 'new name').seedKey
    );
  });

  it('gives different users different seeds', () => {
    expect(identity('1').seedKey).not.toBe(identity('2').seedKey);
  });

  it('tolerates a missing username', () => {
    expect(identity('123', '').label).toMatch(/^user {4}[0-9a-f]{8} {4}123$/);
  });
});

describe('watermarkPlate', () => {
  it('keeps the size and format and leaves the plate looking the same', async () => {
    const original = await whitePlate(1400, 1000);
    const marked = await watermarkPlate(original, identity('42', 'pilot'));

    const meta = await sharp(marked).metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([1400, 1000]);

    const { data } = await sharp(marked)
      .raw()
      .toBuffer({ resolveWithObject: true });
    let darkest = 255;
    for (let i = 0; i < data.length; i++) darkest = Math.min(darkest, data[i]);
    expect(darkest).toBeGreaterThan(225);
  });

  it('produces different bytes for different viewers', async () => {
    const plate = await whitePlate(1000, 700);
    const a = await watermarkPlate(plate, identity('1', 'alice'));
    const b = await watermarkPlate(plate, identity('2', 'bob'));
    expect(a.equals(b)).toBe(false);
  });

  it('is deterministic for one viewer', async () => {
    const plate = await whitePlate(600, 400);
    const a = await watermarkPlate(plate, identity('3', 'carol'));
    const b = await watermarkPlate(plate, identity('3', 'carol'));
    expect(a.equals(b)).toBe(true);
  });
});
