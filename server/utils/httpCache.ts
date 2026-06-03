import type { Response } from "express";

export const CACHE_IMMUTABLE_SEC = 31536000;

export interface PublicCacheOptions {
  browserMaxAge: number;
  edgeMaxAge?: number;
  vary?: string | string[];
}

export function applyPublicCache(
  res: Response,
  opts: PublicCacheOptions
): void {
  const edge = opts.edgeMaxAge ?? opts.browserMaxAge;
  res.setHeader(
    "Cache-Control",
    `public, max-age=${opts.browserMaxAge}, s-maxage=${edge}`
  );
  res.setHeader("CDN-Cache-Control", `public, max-age=${edge}`);
  if (opts.vary) {
    const v = Array.isArray(opts.vary) ? opts.vary.join(", ") : opts.vary;
    res.setHeader("Vary", v);
  }
}

export function applyImmutableAsset(res: Response): void {
  res.setHeader(
    "Cache-Control",
    `public, max-age=${CACHE_IMMUTABLE_SEC}, immutable`
  );
}

/** Vite/Rollup: `name-[hash].ext` (hash may contain `-` / `_`). */
export function filenameLooksContentHashed(filePath: string): boolean {
  const base = filePath.replace(/\\/g, "/").split("/").pop() ?? "";
  return /^[^.-]+-[A-Za-z0-9_-]{6,}\.[a-z0-9]+$/i.test(base);
}
