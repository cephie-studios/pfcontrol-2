import sharp from 'sharp';

const ICON_PX = 96;

const RUNWAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 20h20"/>
  <path d="M7 20V8l5-5 5 5v12"/>
  <path d="M12 3v5"/>
</svg>`;

const ATIS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
  <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4"/>
  <circle cx="12" cy="12" r="2" fill="#34d399"/>
  <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19.1"/>
  <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4"/>
</svg>`;

const FLIGHTS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 19 4c-1 0-2 1-3.5 2.5L12 10 4 8l-1 2 4 2-3 3 2 1 3-4 4 6 1-1z"/>
</svg>`;

const CONTROLLER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 21h18"/>
  <path d="M5 21V7l8-4v18"/>
  <path d="M19 21V11l-6-3"/>
  <path d="M9 9v.01"/>
  <path d="M9 12v.01"/>
  <path d="M9 15v.01"/>
  <path d="M9 18v.01"/>
</svg>`;

let cached: {
  runway: string;
  atis: string;
  flights: string;
  controller: string;
} | null = null;

async function rasterizeSvg(svg: string): Promise<string> {
  const png = await sharp(Buffer.from(svg))
    .resize(ICON_PX, ICON_PX, { fit: 'contain' })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

export type OgSessionIcons = {
  runway: string;
  atis: string;
  flights: string;
  controller: string;
};

export async function loadOgSessionIcons(): Promise<OgSessionIcons> {
  if (cached) return cached;

  const [runway, atis, flights, controller] = await Promise.all([
    rasterizeSvg(RUNWAY_SVG),
    rasterizeSvg(ATIS_SVG),
    rasterizeSvg(FLIGHTS_SVG),
    rasterizeSvg(CONTROLLER_SVG),
  ]);

  cached = { runway, atis, flights, controller };
  return cached;
}