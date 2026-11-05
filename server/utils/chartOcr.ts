import path from 'node:path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const TILE_PX = 1600;
const OVERLAP_PX = 120;
const MAX_TILES = 20;
const INK_THRESHOLD = 150;
const ASSUMED_DPI = '300';
const MIN_CONFIDENCE = 50;
const SPARSE_TEXT = '11';
const LANG_PATH = path.resolve(
  process.cwd(),
  'node_modules/@tesseract.js-data/eng/4.0.0_best_int'
);

interface OcrWord {
  text: string;
  confidence: number;
}

interface OcrBlock {
  paragraphs: { lines: { words: OcrWord[] }[] }[];
}

export function normalizeToken(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9.\-/]/g, '');
}

function tileOrigins(length: number): number[] {
  if (length <= TILE_PX) return [0];
  const step = TILE_PX - OVERLAP_PX;
  const origins: number[] = [];
  for (let start = 0; start + TILE_PX < length; start += step) {
    origins.push(start);
  }
  origins.push(length - TILE_PX);
  return origins;
}

export async function readChartText(image: Buffer): Promise<string[]> {
  let source = sharp(image).flatten({ background: '#ffffff' }).greyscale();
  const { width = 0, height = 0 } = await sharp(image).metadata();

  const tilesAcross = tileOrigins(width).length;
  const tilesDown = tileOrigins(height).length;
  let scale = 1;
  if (tilesAcross * tilesDown > MAX_TILES) {
    scale = Math.sqrt(MAX_TILES / (tilesAcross * tilesDown));
    source = source.resize(Math.round(width * scale));
  }
  const inked = await source.threshold(INK_THRESHOLD).png().toBuffer();
  const scaledWidth = Math.round(width * scale);
  const scaledHeight = Math.round(height * scale);

  const worker = await createWorker('eng', 1, {
    langPath: LANG_PATH,
    gzip: true,
    cacheMethod: 'none',
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: SPARSE_TEXT,
      user_defined_dpi: ASSUMED_DPI,
    } as never);
    const words = new Set<string>();
    for (const top of tileOrigins(scaledHeight)) {
      for (const left of tileOrigins(scaledWidth)) {
        const tile = await sharp(inked)
          .extract({
            left,
            top,
            width: Math.min(TILE_PX, scaledWidth),
            height: Math.min(TILE_PX, scaledHeight),
          })
          .png()
          .toBuffer();
        const { data } = await worker.recognize(tile, {}, { blocks: true });
        const blocks = (data.blocks ?? []) as unknown as OcrBlock[];
        for (const block of blocks) {
          for (const paragraph of block.paragraphs) {
            for (const line of paragraph.lines) {
              for (const word of line.words) {
                const token = normalizeToken(word.text);
                if (word.confidence >= MIN_CONFIDENCE && token.length >= 2) {
                  words.add(token);
                }
              }
            }
          }
        }
      }
    }
    return [...words];
  } finally {
    await worker.terminate();
  }
}
