import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROBLOX_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">
  <path fill="#00A2FF" fill-rule="evenodd" d="M12.581 3.258h-.001L3.609 5.13v13.74l8.97 1.872 8.97-1.872V5.13l-8.968-1.872zM6.456 16.287V7.713l5.544-1.158v9.732L6.456 16.287zm11.088 0l-5.544-1.158V6.555l5.544 1.158v8.574z"/>
</svg>`;

const STAR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">
  <path fill="#eab308" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
</svg>`;

const ICON_PX = 96;
const VATSIM_PAD = 10;

let cached: {
  roblox: string;
  vatsim: string;
  star: string;
} | null = null;

function toPngDataUrl(buf: Buffer): string {
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function rasterizeSvg(svg: string): Promise<string> {
  const png = await sharp(Buffer.from(svg))
    .resize(ICON_PX, ICON_PX, { fit: 'contain' })
    .png()
    .toBuffer();
  return toPngDataUrl(png);
}

async function rasterizeVatsim(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) return null;
  const png = await sharp(filePath)
    .resize(ICON_PX - VATSIM_PAD * 2, ICON_PX - VATSIM_PAD * 2, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: VATSIM_PAD,
      bottom: VATSIM_PAD,
      left: VATSIM_PAD,
      right: VATSIM_PAD,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return toPngDataUrl(png);
}

export async function loadOgLinkIcons(): Promise<{
  roblox: string;
  vatsim: string;
  star: string;
}> {
  if (cached) return cached;

  const vatsimPath = path.join(
    process.cwd(),
    'public',
    'assets',
    'images',
    'vatsim.webp'
  );
  const robloxPath = path.join(
    process.cwd(),
    'public',
    'assets',
    'images',
    'roblox.webp'
  );

  let roblox: string;
  if (fs.existsSync(robloxPath)) {
    const png = await sharp(robloxPath)
      .resize(ICON_PX, ICON_PX, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    roblox = toPngDataUrl(png);
  } else {
    roblox = await rasterizeSvg(ROBLOX_ICON_SVG);
  }

  const vatsim =
    (await rasterizeVatsim(vatsimPath)) ??
    (await rasterizeSvg(ROBLOX_ICON_SVG));
  const star = await rasterizeSvg(STAR_ICON_SVG);

  cached = { roblox, vatsim, star };
  return cached;
}
