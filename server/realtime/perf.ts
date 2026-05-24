const PERF_ENABLED =
  process.env.PERF_LOG !== "0" &&
  (process.env.PERF_LOG === "1" || process.env.NODE_ENV !== "production");

export async function perfAsync<T>(
  label: string,
  fn: () => Promise<T>,
  meta?: Record<string, string | number | boolean>
): Promise<T> {
  if (!PERF_ENABLED) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration_ms = Math.round(performance.now() - start);
    console.log("[perf]", JSON.stringify({ label, duration_ms, ...meta }));
  }
}

export function perfSync<T>(
  label: string,
  fn: () => T,
  meta?: Record<string, string | number | boolean>
): T {
  if (!PERF_ENABLED) return fn();
  const start = performance.now();
  try {
    return fn();
  } finally {
    const duration_ms = Math.round(performance.now() - start);
    console.log("[perf]", JSON.stringify({ label, duration_ms, ...meta }));
  }
}