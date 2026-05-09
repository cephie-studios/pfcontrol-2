import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { redisStore } = vi.hoisted(() => ({
  redisStore: new Map<string, string>(),
}));

vi.mock("../../../server/db/connection.js", () => ({
  redisConnection: {
    get: vi.fn((k: string) => Promise.resolve(redisStore.get(k) ?? null)),
    set: vi.fn((k: string, v: string, ..._rest: unknown[]) => {
      redisStore.set(k, v);
      return Promise.resolve("OK");
    }),
    keys: vi.fn((pattern: string) => {
      const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
      return Promise.resolve(Array.from(redisStore.keys()).filter((key) => key.startsWith(prefix)));
    }),
    del: vi.fn((...keys: string[]) => {
      let n = 0;
      for (const key of keys) {
        if (redisStore.delete(key)) n++;
      }
      return Promise.resolve(n);
    }),
  },
}));

import {
  clearMetarCacheForTests,
  resolveAviationMetar,
} from "../../../server/utils/metarAviationWeather.js";

describe("resolveAviationMetar", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    redisStore.clear();
    await clearMetarCacheForTests();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await clearMetarCacheForTests();
    redisStore.clear();
    vi.useRealTimers();
  });

  it("returns stale cache from Redis when upstream errors after the fresh window", async () => {
    vi.useFakeTimers();
    const t0 = new Date("2025-06-01T12:00:00.000Z").getTime();
    vi.setSystemTime(t0);

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify([{ rawOb: "METAR EGLL 121200Z 27010KT", wdir: 270, wspd: 10 }]),
    } as Response);
    globalThis.fetch = fetchMock;

    const r1 = await resolveAviationMetar("EGLL");
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.stale).toBe(false);
      expect(r1.cacheHit).toBe(false);
    }

    vi.setSystemTime(t0 + 4 * 60 * 1000);
    fetchMock.mockRejectedValue(new Error("network"));

    const pending = resolveAviationMetar("EGLL");
    await vi.advanceTimersByTimeAsync(20_000);
    const r2 = await pending;

    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.stale).toBe(true);
      expect(r2.cacheHit).toBe(true);
      expect(String(r2.body.rawOb)).toContain("EGLL");
    }
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});