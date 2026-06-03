import sharp from 'sharp';

function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(',');
  return Buffer.from(dataUrl.slice(comma + 1), 'base64');
}

export async function toSatoriSafeDataUrl(
  dataUrl: string | null
): Promise<string | null> {
  if (!dataUrl) return null;
  const needsConvert =
    dataUrl.startsWith('data:image/webp') ||
    dataUrl.startsWith('data:image/avif') ||
    dataUrl.startsWith('data:image/svg+xml');
  if (!needsConvert) return dataUrl;
  try {
    const pngBuf = await sharp(dataUrlToBuffer(dataUrl)).png().toBuffer();
    return `data:image/png;base64,${pngBuf.toString('base64')}`;
  } catch {
    return null;
  }
}
