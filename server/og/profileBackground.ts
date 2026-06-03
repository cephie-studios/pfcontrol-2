import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { PublicPilotProfile } from "../services/publicPilotProfile.js";

const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".svg",
]);

export type ResolvedBackground =
  | { kind: "local"; filePath: string }
  | { kind: "remote"; url: string };

function backgroundsDir(): string {
  return path.join(process.cwd(), "public", "assets", "app", "backgrounds");
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
  const n = createHash("sha256").update(seed).digest().readUInt32BE(0);
  return n % modulo;
}

type BackgroundImageJson = {
  selectedImage?: string | null;
  favorites?: string[];
  useCustomBackground?: boolean;
};

function resolveFilename(
  filename: string,
  frontendBase: string
): ResolvedBackground | null {
  if (!filename || filename === "random" || filename === "favorites") {
    return null;
  }
  if (/^https?:\/\//i.test(filename)) {
    return { kind: "remote", url: filename };
  }

  const localPath = path.join(backgroundsDir(), filename);
  if (fs.existsSync(localPath)) {
    return { kind: "local", filePath: localPath };
  }
  // File not found locally — fall back to the hero image.
  const heroPath = path.join(
    process.cwd(),
    "public",
    "assets",
    "images",
    "hero.webp"
  );
  if (fs.existsSync(heroPath)) {
    return { kind: "local", filePath: heroPath };
  }
  return null;
}

export function resolveProfileBackground(
  profile: PublicPilotProfile,
  frontendBase: string
): ResolvedBackground | null {
  if (!profile.privacySettings.displayBackgroundOnProfile) {
    return null;
  }
  const raw = profile.user.background_image;
  if (!raw || typeof raw !== "object") return null;

  const bg = raw as BackgroundImageJson;
  const selected = bg.selectedImage;
  if (!selected || typeof selected !== "string") return null;

  const seed = profile.user.username;

  if (selected === "random") {
    const files = listBackgroundFilenames();
    if (!files.length) return null;
    const pick = files[stableIndex(seed, files.length)]!;
    return resolveFilename(pick, frontendBase);
  }

  if (selected === "favorites") {
    const favs = Array.isArray(bg.favorites)
      ? bg.favorites.filter(
          (x): x is string => typeof x === "string" && x.length > 0
        )
      : [];
    if (!favs.length) return null;
    const sorted = [...favs].sort();
    const pick = sorted[stableIndex(seed, sorted.length)]!;
    return resolveFilename(pick, frontendBase);
  }

  return resolveFilename(selected, frontendBase);
}
