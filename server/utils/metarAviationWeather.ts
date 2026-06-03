import { redisConnection } from '../db/connection.js';

const FRESH_CACHE_MS = 3 * 60 * 1000;
const STALE_MAX_MS = 45 * 60 * 1000;
const REDIS_METAR_PREFIX = 'metar:v1:';
const REDIS_TTL_SEC = Math.ceil(STALE_MAX_MS / 1000);

type MetarBody = Record<string, unknown>;

type RedisMetarPayload = {
  body: MetarBody;
  storedAt: number;
};

function redisKey(icaoKey: string): string {
  return `${REDIS_METAR_PREFIX}${icaoKey}`;
}

export async function clearMetarCacheForTests(): Promise<void> {
  try {
    const keys = await redisConnection.keys(`${REDIS_METAR_PREFIX}*`);
    if (keys.length > 0) {
      await redisConnection.del(...keys);
    }
  } catch {
    // Redis unavailable or mock without keys()
  }
}

function normalizeIcao(icao: string): string {
  return icao.trim().toUpperCase();
}

function cloneBody(body: MetarBody): MetarBody {
  return JSON.parse(JSON.stringify(body)) as MetarBody;
}

function applyWindFallback(metar: MetarBody): MetarBody {
  const m = { ...metar } as MetarBody & {
    wdir?: number | null;
    wspd?: number | null;
    wgst?: number | null;
    rawOb?: string;
  };

  if ((m.wdir == null || m.wspd == null) && m.rawOb) {
    const windMatch = m.rawOb.match(
      /\b(\d{3})(\d{2,3})(?:G(\d{2,3}))?K(?:T)?\b/
    );
    if (windMatch) {
      if (m.wdir == null) m.wdir = parseInt(windMatch[1], 10);
      if (m.wspd == null) m.wspd = parseInt(windMatch[2], 10);
      if (m.wgst == null && windMatch[3]) m.wgst = parseInt(windMatch[3], 10);
    }
  }

  return m;
}

async function getRedisEntry(
  icaoKey: string
): Promise<RedisMetarPayload | null> {
  try {
    const raw = await redisConnection.get(redisKey(icaoKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('body' in parsed) ||
      !('storedAt' in parsed)
    ) {
      return null;
    }
    const rec = parsed as { body: MetarBody; storedAt: unknown };
    if (typeof rec.storedAt !== 'number' || rec.body == null) return null;
    return { body: rec.body, storedAt: rec.storedAt };
  } catch (e) {
    console.warn('[METAR] Redis read failed:', e);
    return null;
  }
}

async function setRedisEntry(
  icaoKey: string,
  body: MetarBody,
  storedAt: number
): Promise<void> {
  try {
    const payload: RedisMetarPayload = {
      body: cloneBody(body),
      storedAt,
    };
    await redisConnection.set(
      redisKey(icaoKey),
      JSON.stringify(payload),
      'EX',
      REDIS_TTL_SEC
    );
  } catch (e) {
    console.warn('[METAR] Redis write failed:', e);
  }
}

async function fetchWithRetry(
  url: string,
  maxRetries = 2,
  timeoutMs = 10000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timeoutId);
      return response;
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error) {
        lastError = fetchError;

        if (attempt === maxRetries) {
          if (fetchError.name === 'AbortError') {
            throw new Error(
              'Request timed out. The weather service is taking too long to respond.'
            );
          }
          throw new Error(
            `Failed to connect to weather service after ${maxRetries + 1} attempts: ${fetchError.message}`
          );
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1))
        );
      }
    }
  }

  throw lastError || new Error('Unknown error during fetch');
}

export type ResolveMetarOk = {
  ok: true;
  body: MetarBody;
  stale: boolean;
  cacheHit: boolean;
};

export type ResolveMetarMiss = {
  ok: false;
  httpStatus: 404 | 500;
  clientMessage: string;
  log?: string;
};

export type ResolveMetarResult = ResolveMetarOk | ResolveMetarMiss;

export async function resolveAviationMetar(
  icao: string
): Promise<ResolveMetarResult> {
  const key = normalizeIcao(icao);
  const now = Date.now();
  const redisEntry = await getRedisEntry(key);

  if (redisEntry && now - redisEntry.storedAt <= FRESH_CACHE_MS) {
    return {
      ok: true,
      body: cloneBody(applyWindFallback(redisEntry.body)),
      stale: false,
      cacheHit: true,
    };
  }

  const staleFrom = (
    e: RedisMetarPayload | null
  ): ResolveMetarResult | null => {
    if (!e) return null;
    const t = Date.now();
    if (t - e.storedAt > STALE_MAX_MS) return null;
    return {
      ok: true,
      body: cloneBody(applyWindFallback(e.body)),
      stale: true,
      cacheHit: true,
    };
  };

  try {
    const response = await fetchWithRetry(
      `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(key)}&format=json`
    );

    if (!response.ok) {
      const miss = staleFrom(redisEntry);
      if (miss) return miss;
      if (response.status === 404) {
        return {
          ok: false,
          httpStatus: 404,
          clientMessage: 'No METAR data available for this airport',
        };
      }
      return {
        ok: false,
        httpStatus: 500,
        clientMessage: 'Failed to fetch METAR data',
        log: `Upstream status ${response.status}`,
      };
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      const miss = staleFrom(redisEntry);
      if (miss) return miss;
      return {
        ok: false,
        httpStatus: 404,
        clientMessage: 'No METAR data found',
      };
    }

    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch (parseError) {
      console.error(`Failed to parse METAR response for ${key}:`, parseError);
      const miss = staleFrom(redisEntry);
      if (miss) return miss;
      return {
        ok: false,
        httpStatus: 500,
        clientMessage: 'Invalid METAR data format',
      };
    }

    if (Array.isArray(data) && data.length > 0) {
      const raw = data[0] as MetarBody;
      const body = applyWindFallback(raw);
      await setRedisEntry(key, body, Date.now());
      return { ok: true, body, stale: false, cacheHit: false };
    }

    console.warn(`No data in METAR response array for ${key}`);
    const miss = staleFrom(redisEntry);
    if (miss) return miss;
    return {
      ok: false,
      httpStatus: 404,
      clientMessage: 'No METAR data available for this airport',
      log: 'The airport may not exist or has no current weather report',
    };
  } catch (error) {
    console.error('Error fetching METAR:', error);
    const miss = staleFrom(redisEntry);
    if (miss) return miss;
    return {
      ok: false,
      httpStatus: 500,
      clientMessage: 'Internal server error',
      log: error instanceof Error ? error.message : String(error),
    };
  }
}
