import type { NextFunction, Request, Response } from 'express';


export function toCamelCaseJson<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => toCamelCaseJson(item)) as T;
  }

  if (
    value !== null &&
    typeof value === 'object' &&
    value.constructor === Object
  ) {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      const camelKey = key.replace(/_([a-z0-9])/g, (_, c: string) =>
        c.toUpperCase()
      );
      result[camelKey] = toCamelCaseJson(v);
    }
    return result as T;
  }

  return value as T;
}

const FLIGHT_FIELD_CAMEL_TO_DB: Record<string, string> = {
  cruisingFL: 'cruisingfl',
  clearedFL: 'clearedfl',
};

export function fromCamelCaseFlightBody(
  body: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    const dbKey =
      FLIGHT_FIELD_CAMEL_TO_DB[key] ??
      key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    result[dbKey] = value;
  }
  return result;
}

export function camelCaseJsonResponses(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  const originalJson = res.json.bind(res);
  res.json = ((body?: unknown) => originalJson(toCamelCaseJson(body))) as typeof res.json;
  next();
}
