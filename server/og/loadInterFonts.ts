import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function interFilesDir(): string {
  const pkgJson = require.resolve('@fontsource/inter/package.json');
  return join(dirname(pkgJson), 'files');
}

let inter400: ArrayBuffer | undefined;
let inter700: ArrayBuffer | undefined;

export async function getInterFontsForSatori(): Promise<
  Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }>
> {
  if (!inter400 || !inter700) {
    const filesDir = interFilesDir();
    inter400 = bufferToArrayBuffer(
      readFileSync(join(filesDir, 'inter-latin-400-normal.woff'))
    );
    inter700 = bufferToArrayBuffer(
      readFileSync(join(filesDir, 'inter-latin-700-normal.woff'))
    );
  }
  return [
    { name: 'Inter', data: inter400, weight: 400, style: 'normal' },
    { name: 'Inter', data: inter700, weight: 700, style: 'normal' },
  ];
}
