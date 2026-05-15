import sharp from 'sharp';

const ICON_PX = 160;

const RUNWAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="3" y="17" width="18" height="4" rx="1" fill="#475569"/>
  <path fill="#38bdf8" d="M12 2 8 17h8L12 2zm0 5 2 8h-4l2-8z"/>
  <rect x="11" y="4" width="2" height="5" rx="0.5" fill="#e0f2fe"/>
</svg>`;

const ATIS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="10" fill="#064e3b"/>
  <circle cx="12" cy="12" r="6.5" fill="none" stroke="#34d399" stroke-width="2"/>
  <circle cx="12" cy="12" r="3.25" fill="#6ee7b7"/>
</svg>`;

const FLIGHTS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="#a78bfa" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
</svg>`;

let cached: { runway: string; atis: string; flights: string } | null = null;

async function rasterizeSvg(svg: string): Promise<string> {
  const png = await sharp(Buffer.from(svg))
    .resize(ICON_PX, ICON_PX, { fit: 'contain', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

export type OgSessionIcons = {
  runway: string;
  atis: string;
  flights: string;
};

export async function loadOgSessionIcons(): Promise<OgSessionIcons> {
  if (cached) return cached;

  const [runway, atis, flights] = await Promise.all([
    rasterizeSvg(RUNWAY_SVG),
    rasterizeSvg(ATIS_SVG),
    rasterizeSvg(FLIGHTS_SVG),
  ]);

  cached = { runway, atis, flights };
  return cached;
}