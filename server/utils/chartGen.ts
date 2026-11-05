const BASE_URL = (process.env.CHART_GEN_URL ?? '').replace(/\/+$/, '');
const TOKEN = process.env.CHART_GEN_TOKEN ?? '';
const TIMEOUT_MS = 15_000;

export interface ChartGenResponse {
  status: number;
  body: Buffer;
  version: string | null;
}

export async function fetchChartGen(
  path: string
): Promise<ChartGenResponse | null> {
  if (!BASE_URL || !TOKEN) return null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return {
      status: res.status,
      body: Buffer.from(await res.arrayBuffer()),
      version: res.headers.get('x-charts-version'),
    };
  } catch (error) {
    console.error('[Charts] Chart API unreachable:', error);
    return null;
  }
}
