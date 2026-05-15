import fs from 'node:fs';
import path from 'node:path';

const ROBLOX_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#d4d4d8"><path d="M12.581 3.258h-.001L3.609 5.13v13.74l8.97 1.872 8.97-1.872V5.13l-8.968-1.872zM6.456 16.287V7.713l5.544-1.158v9.732L6.456 16.287zm11.088 0l-5.544-1.158V6.555l5.544 1.158v8.574z"/></svg>`;

const STAR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#eab308"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

let cached: {
  roblox: string;
  vatsim: string | null;
  star: string;
} | null = null;

function fileToDataUrl(filePath: string, mime: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export function getOgLinkIcons(): {
  roblox: string;
  vatsim: string | null;
  star: string;
} {
  if (cached) return cached;

  const vatsimPath = path.join(
    process.cwd(),
    'public',
    'assets',
    'images',
    'vatsim.webp'
  );

  cached = {
    roblox: svgToDataUrl(ROBLOX_ICON_SVG),
    vatsim: fileToDataUrl(vatsimPath, 'image/webp'),
    star: svgToDataUrl(STAR_ICON_SVG),
  };

  return cached;
}
