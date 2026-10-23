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
const WEBP_QUALITY = 95;
const TILE_CACHE_LIMIT = 100;

interface Tile {
  width: number;
  height: number;
  body: string;
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
  const body = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));

  if (tileCache.size >= TILE_CACHE_LIMIT) {
    tileCache.delete(tileCache.keys().next().value as string);
  }
  const tile = { width, height, body };
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

function cellNoise(seedKey: string, width: number, height: number) {
  const cols = cellColumns(width);
  const rows = Math.ceil(height / CELL_PX);
  const seed = seedFromKey(seedKey);
  const noise = new Float32Array(cols * rows);
  for (let i = 0; i < noise.length; i++) noise[i] = noiseValue(seed, i);
  return { cols, rows, noise };
}

async function textMask(
  label: string,
  width: number,
  height: number
): Promise<Uint8Array> {
  const fontSize = Math.min(
    MAX_FONT_PX,
    Math.max(MIN_FONT_PX, Math.round(width / FONT_DIVISOR))
  );
  const tile = await renderTile(label, fontSize, width);
  const tileImage = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${tile.width}" height="${tile.height}">${tile.body}</svg>`
    )
  )
    .png()
    .toBuffer();
  const { data } = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: tileImage, tile: true, gravity: 'northwest' }])
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i] > 96 ? 1 : 0;
  return mask;
}

export async function watermarkPlate(
  plate: Buffer,
  identity: WatermarkIdentity
): Promise<Buffer> {
  const [{ data, info }, meta] = await Promise.all([
    sharp(plate).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(plate).metadata(),
  ]);
  const width = meta.width ?? info.width;
  const height = meta.height ?? info.height;
  const mask = await textMask(identity.label, width, height);
  const { cols, noise } = cellNoise(identity.seedKey, width, height);

  for (let y = 0; y < height; y++) {
    const cellRow = Math.floor(y / CELL_PX) * cols;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const amplitude = mask[i] ? TEXT_AMPLITUDE : BASE_AMPLITUDE;
      const strength =
        NOISE_MEAN +
        (noise[cellRow + Math.floor(x / CELL_PX)] - 0.5) * 2 * amplitude;
      const offset = i * 3;
      for (let channel = 0; channel < 3; channel++) {
        const value = data[offset + channel];
        data[offset + channel] = Math.min(
          255,
          Math.max(0, Math.round(value - (strength * value) / 255))
        );
      }
    }
  }

  return sharp(data, { raw: { width, height, channels: 3 } })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
