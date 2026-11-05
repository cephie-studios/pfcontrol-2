import { createHash } from 'node:crypto';
import { createElement } from 'react';
import satori from 'satori';
import sharp from 'sharp';
import { getInterFontsForSatori } from '../og/loadInterFonts.js';
import { chartSubjectForUserId } from './chartSubject.js';

export const WATERMARK_VERSION = 5;
export const CELL_PX = 3;
export const BASE_AMPLITUDE = 2.5;

const SEPARATOR = ' '.repeat(4);
const TOKEN_GAP_EM = 0.85;
const ROW_PITCH_EM = 1.15;
const TEXT_AMPLITUDE = 6;
const NOISE_MEAN = 3;
const MIN_FONT_PX = 16;
const MAX_FONT_PX = 44;
const FONT_DIVISOR = 110;
const MASK_THRESHOLD = 96;
const WEBP_QUALITY = 95;
const WEBP_EFFORT = 1;
const TILE_CACHE_LIMIT = 50;
const CELL_ROWS_PER_SLICE = 64;

interface Tile {
  width: number;
  height: number;
  mask: Uint8Array;
}

const tileCache = new Map<string, Tile>();

export interface WatermarkIdentity {
  label: string;
  seedKey: string;
}

export function watermarkSeedKey(userId: string): string | null {
  const subject = chartSubjectForUserId(userId);
  return subject ? `${subject}:${userId}` : null;
}

export function watermarkIdentity(
  userId: string,
  username: string
): WatermarkIdentity | null {
  const seedKey = watermarkSeedKey(userId);
  if (!seedKey) return null;
  const name = username.replace(/\s+/g, ' ').trim().slice(0, 32) || 'user';
  const code = seedKey.slice(0, 8);
  return { label: [name, code, userId].join(SEPARATOR), seedKey };
}

async function renderTile(
  label: string,
  fontSize: number,
  width: number
): Promise<Tile> {
  const key = `${width}:${fontSize}:${label}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  const rowHeight = Math.round(fontSize * ROW_PITCH_EM);
  const height = rowHeight * 2;
  const repeats = Math.ceil(width / (label.length * fontSize * 0.45)) + 2;
  const tokens = Array.from({ length: repeats }, () =>
    label.split(SEPARATOR)
  ).flat();
  const text = (left: number, top: number) =>
    createElement(
      'div',
      {
        style: {
          position: 'absolute',
          left,
          top,
          display: 'flex',
          gap: Math.round(fontSize * TOKEN_GAP_EM),
          fontSize,
          fontWeight: 700,
          color: 'rgb(0, 0, 0)',
          whiteSpace: 'pre',
        },
      },
      ...tokens.map((token, index) =>
        createElement('div', { key: index, style: { display: 'flex' } }, token)
      )
    );

  const svg = await satori(
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          width,
          height,
        },
      },
      text(0, Math.round(rowHeight / 2 - fontSize / 2)),
      text(-fontSize * 14, Math.round(rowHeight * 1.5 - fontSize / 2))
    ),
    { width, height, fonts: await getInterFontsForSatori() }
  );
  const { data } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = data[i] > MASK_THRESHOLD ? 1 : 0;
  }

  if (tileCache.size >= TILE_CACHE_LIMIT) {
    tileCache.delete(tileCache.keys().next().value as string);
  }
  const tile = { width, height, mask };
  tileCache.set(key, tile);
  return tile;
}

export function seedFromKey(seedKey: string): number {
  return createHash('sha256').update(seedKey).digest().readUInt32LE(0);
}

export function noiseValue(seed: number, index: number): number {
  const state = (seed + Math.imul(index + 1, 0x6d2b79f5)) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function cellColumns(width: number): number {
  return Math.ceil(width / CELL_PX);
}

function fontSizeFor(width: number): number {
  return Math.min(
    MAX_FONT_PX,
    Math.max(MIN_FONT_PX, Math.round(width / FONT_DIVISOR))
  );
}

const yieldToEventLoop = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

export async function watermarkPlate(
  plate: Buffer,
  identity: WatermarkIdentity
): Promise<Buffer> {
  const [{ data, info }, tile] = await Promise.all([
    sharp(plate).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(plate)
      .metadata()
      .then((meta) =>
        renderTile(identity.label, fontSizeFor(meta.width!), meta.width!)
      ),
  ]);
  const { width, height } = info;
  const pixels = new Uint8ClampedArray(
    data.buffer,
    data.byteOffset,
    data.length
  );
  const seed = seedFromKey(identity.seedKey);
  const cols = cellColumns(width);
  const baseStrength = new Float64Array(cols);
  const textStrength = new Float64Array(cols);

  for (let y = 0; y < height; y++) {
    if (y % CELL_PX === 0) {
      const cellRow = y / CELL_PX;
      if (cellRow > 0 && cellRow % CELL_ROWS_PER_SLICE === 0) {
        await yieldToEventLoop();
      }
      // The original kept noise in a Float32Array; fround keeps output identical.
      for (let col = 0, index = cellRow * cols; col < cols; col++, index++) {
        const offset = (Math.fround(noiseValue(seed, index)) - 0.5) * 2;
        baseStrength[col] = NOISE_MEAN + offset * BASE_AMPLITUDE;
        textStrength[col] = NOISE_MEAN + offset * TEXT_AMPLITUDE;
      }
    }
    const maskRow = (y % tile.height) * width;
    let p = y * width * 3;
    for (let x = 0; x < width; x++, p += 3) {
      const col = (x / CELL_PX) | 0;
      const strength = tile.mask[maskRow + x]
        ? textStrength[col]
        : baseStrength[col];
      const r = pixels[p];
      const g = pixels[p + 1];
      const b = pixels[p + 2];
      pixels[p] = Math.round(r - (strength * r) / 255);
      pixels[p + 1] = Math.round(g - (strength * g) / 255);
      pixels[p + 2] = Math.round(b - (strength * b) / 255);
    }
  }

  return sharp(data, { raw: { width, height, channels: 3 } })
    .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
    .toBuffer();
}
