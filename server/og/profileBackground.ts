import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { PublicPilotProfile } from '../services/publicPilotProfile.js';

const IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.svg',
]);

function backgroundsDir(): string {
  return path.join(process.cwd(), 'public', 'assets', 'app', 'backgrounds');
}

export function listBackgroundFilenames(): string[] {
  const dir = backgroundsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => IMAGE_EXT.has(path.extname(file).toLowerCase()))
    .sort();
}

function stableIndex(seed: string, modulo: number): number {
  if (modulo <= 0) return 0;
  const n = createHash('sha256').update(seed).digest().readUInt32BE(0);
  return n % modulo;
}

type BackgroundImageJson = {
  selectedImage?: string | null;
  favorites?: string[];
  useCustomBackground?: boolean;
};

function resolveFilenameToUrl(
  filename: string,
  frontendBase: string
): string | null {
  if (!filename || filename === 'random' || filename === 'favorites') {
    return null;
  }
  if (/^https?:\/\//i.test(filename)) {
    return filename;
  }
  const base = frontendBase.replace(/\/$/, '');
  return `${base}/assets/app/backgrounds/${filename}`;
}

export function resolveProfileBackgroundImageUrl(
  profile: PublicPilotProfile,
  frontendBase: string
): string | null {
  if (!profile.privacySettings.displayBackgroundOnProfile) {
    return null;
  }
  const raw = profile.user.background_image;
  if (!raw || typeof raw !== 'object') return null;

  const bg = raw as BackgroundImageJson;
  const selected = bg.selectedImage;
  if (!selected || typeof selected !== 'string') return null;

  const seed = profile.user.username;

  if (selected === 'random') {
    const files = listBackgroundFilenames();
    if (!files.length) return null;
    const pick = files[stableIndex(seed, files.length)]!;
    return resolveFilenameToUrl(pick, frontendBase);
  }

  if (selected === 'favorites') {
    const favs = Array.isArray(bg.favorites)
      ? bg.favorites.filter(
          (x): x is string => typeof x === 'string' && x.length > 0
        )
      : [];
    if (!favs.length) return null;
    const sorted = [...favs].sort();
    const pick = sorted[stableIndex(seed, sorted.length)]!;
    return resolveFilenameToUrl(pick, frontendBase);
  }

  return resolveFilenameToUrl(selected, frontendBase);
}