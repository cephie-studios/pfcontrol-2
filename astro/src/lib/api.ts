import { env } from 'node:process';

export function getInternalApiBase(): string {
  const port = env.PORT ?? '9900';
  return `http://127.0.0.1:${port}`;
}

export async function fetchApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${getInternalApiBase()}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
