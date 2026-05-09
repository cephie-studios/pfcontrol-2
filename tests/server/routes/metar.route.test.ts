import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appRequest } from "../helpers/appRequest.js";

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
      return Promise.resolve([...redisStore.keys()].filter((key) => key.startsWith(prefix)));
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

import metarRouter from "../../../server/routes/metar.js";
import { clearMetarCacheForTests } from "../../../server/utils/metarAviationWeather.js";

describe("GET /api/metar/:icao", () => {
  const app = express();
  app.use("/", metarRouter);

  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    redisStore.clear();
    await clearMetarCacheForTests();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ raw: "METAR EGLL" }]),
    } as Response);
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await clearMetarCacheForTests();
    redisStore.clear();
  });

  it("returns first METAR object when upstream returns json array", async () => {
    const res = await appRequest(app, "GET", "/EGLL");

    expect(res.status).toBe(200);
    expect((res.body as { raw: string }).raw).toContain("EGLL");
  });

  it("uses Redis fresh cache and does not call upstream twice within the fresh window", async () => {
    await appRequest(app, "GET", "/EGLL");
    await appRequest(app, "GET", "/EGLL");

    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(1);
  });
});