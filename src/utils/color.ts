export const PROFILE_THEME_PRESETS = [
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#10B981', // emerald
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#D946EF', // fuchsia
  '#EC4899', // pink
];

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return { r: 0, g: 0, b: 0 };
  }
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }

  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;

  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hueToRgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  return {
    r: hueToRgb(h / 360 + 1 / 3) * 255,
    g: hueToRgb(h / 360) * 255,
    b: hueToRgb(h / 360 - 1 / 3) * 255,
  };
}

function relativeLuminance({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  );
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Alpha-composites fgHex over bgHex and returns the resulting opaque hex color. */
export function blendHexOverBackground(
  fgHex: string,
  alpha: number,
  bgHex: string
): string {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  return rgbToHex(
    fg.r * alpha + bg.r * (1 - alpha),
    fg.g * alpha + bg.g * (1 - alpha),
    fg.b * alpha + bg.b * (1 - alpha)
  );
}

/**
 * Picks a vivid color at the complementary hue of `baseHex`, then nudges its
 * lightness until it has enough contrast against `backgroundHex` to stay
 * legible as an icon color (WCAG-style contrast ratio >= 3).
 */
export function getComplementaryAccessibleColor(
  baseHex: string,
  backgroundHex: string
): string {
  const base = hexToRgb(baseHex);
  const { h } = rgbToHsl(base.r, base.g, base.b);
  const complementaryHue = (h + 180) % 360;
  const saturation = 72;

  let lightness = 68;
  let candidateRgb = hslToRgb(complementaryHue, saturation, lightness);
  let candidateHex = rgbToHex(candidateRgb.r, candidateRgb.g, candidateRgb.b);

  const bgLuminance = relativeLuminance(hexToRgb(backgroundHex));
  const goingLighter = bgLuminance < 0.5;

  let iterations = 0;
  while (contrastRatio(candidateHex, backgroundHex) < 3 && iterations < 20) {
    lightness = goingLighter
      ? Math.min(95, lightness + 3)
      : Math.max(10, lightness - 3);
    candidateRgb = hslToRgb(complementaryHue, saturation, lightness);
    candidateHex = rgbToHex(candidateRgb.r, candidateRgb.g, candidateRgb.b);
    iterations++;
    if (lightness >= 95 || lightness <= 10) break;
  }

  return candidateHex;
}
