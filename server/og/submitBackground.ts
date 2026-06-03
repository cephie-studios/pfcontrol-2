import fs from "node:fs";
import path from "node:path";
import type { ResolvedBackground } from "./profileBackground.js";

function backgroundsDir(): string {
  return path.join(process.cwd(), "public", "assets", "app", "backgrounds");
}

function heroPath(): string {
  return path.join(process.cwd(), "public", "assets", "images", "hero.webp");
}

export function resolveSubmitSessionBackground(
  airportIcao: string
): ResolvedBackground | null {
  const code = airportIcao.trim().toLowerCase();
  if (/^[a-z]{4}$/.test(code)) {
    const airportPath = path.join(backgroundsDir(), `${code}.webp`);
    if (fs.existsSync(airportPath)) {
      return { kind: "local", filePath: airportPath };
    }
  }

  const hero = heroPath();
  if (fs.existsSync(hero)) {
    return { kind: "local", filePath: hero };
  }

  return null;
}
