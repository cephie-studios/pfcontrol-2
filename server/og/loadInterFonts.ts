let inter400: ArrayBuffer | undefined;
let inter700: ArrayBuffer | undefined;

const INTER_400_URL =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter_18pt-Regular.ttf';
const INTER_700_URL =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter_18pt-Bold.ttf';

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Font fetch failed ${res.status}: ${url}`);
  }
  return res.arrayBuffer();
}

export async function getInterFontsForSatori(): Promise<
  Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }>
> {
  if (!inter400 || !inter700) {
    const [a, b] = await Promise.all([
      fetchFont(INTER_400_URL),
      fetchFont(INTER_700_URL),
    ]);
    inter400 = a;
    inter700 = b;
  }
  return [
    { name: 'Inter', data: inter400, weight: 400, style: 'normal' },
    { name: 'Inter', data: inter700, weight: 700, style: 'normal' },
  ];
}