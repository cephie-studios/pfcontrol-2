function isAnimatedWebp(buffer: Buffer): boolean {
  if (buffer.length < 21) return false;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return false;
  if (buffer.toString('ascii', 8, 12) !== 'WEBP') return false;
  if (buffer.toString('ascii', 12, 16) !== 'VP8X') return false;
  return (buffer[20] & 0x02) !== 0;
}

// APNG puts an acTL chunk before the first IDAT.
function isAnimatedPng(buffer: Buffer): boolean {
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'acTL') return true;
    if (type === 'IDAT') return false;
    offset += 12 + length;
  }
  return false;
}

export function isAnimatedImage(buffer: Buffer, mimetype: string): boolean {
  if (mimetype === 'image/gif') return true;
  if (mimetype === 'image/webp') return isAnimatedWebp(buffer);
  if (mimetype === 'image/png' || mimetype === 'image/apng') {
    return isAnimatedPng(buffer);
  }
  return false;
}
