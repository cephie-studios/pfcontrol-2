import type { IncomingMessage } from 'http';

interface HandshakeBucket {
  count: number;
  windowStartedAt: number;
}

interface HandshakeRateLimiterOptions {
  maxAttempts?: number;
  scope: string;
  windowMs?: number;
}

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15min
const DEFAULT_MAX_ATTEMPTS = 250;

const bucketsByScope = new Map<string, Map<string, HandshakeBucket>>();
const cleanupTimersByScope = new Map<string, NodeJS.Timeout>();

function getRequestIp(req: IncomingMessage): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]?.trim()) {
    return forwarded[0].split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();

  return req.socket.remoteAddress ?? 'unknown';
}

function getScopeBuckets(scope: string): Map<string, HandshakeBucket> {
  if (!bucketsByScope.has(scope)) {
    bucketsByScope.set(scope, new Map<string, HandshakeBucket>());
  }
  return bucketsByScope.get(scope)!;
}

function ensureCleanupTimer(scope: string, windowMs: number): void {
  if (cleanupTimersByScope.has(scope)) return;

  const timer = setInterval(() => {
    const buckets = bucketsByScope.get(scope);
    if (!buckets) return;

    const now = Date.now();
    for (const [ip, bucket] of buckets.entries()) {
      if (now - bucket.windowStartedAt > windowMs * 2) {
        buckets.delete(ip);
      }
    }
  }, windowMs);

  timer.unref();
  cleanupTimersByScope.set(scope, timer);
}

function isExistingSocketSession(url: string): boolean {
  return url.includes('sid=');
}

export function createHandshakeRateLimiter(
  options: HandshakeRateLimiterOptions
) {
  const scope = options.scope;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const buckets = getScopeBuckets(scope);
  ensureCleanupTimer(scope, windowMs);

  return (
    req: IncomingMessage,
    callback: (err: string | null, success: boolean) => void
  ) => {
    if (isExistingSocketSession(req.url ?? '')) {
      callback(null, true);
      return;
    }

    const ip = getRequestIp(req);
    const now = Date.now();
    const bucket = buckets.get(ip);

    if (!bucket || now - bucket.windowStartedAt >= windowMs) {
      buckets.set(ip, { count: 1, windowStartedAt: now });
      callback(null, true);
      return;
    }

    if (bucket.count >= maxAttempts) {
      callback('Too many socket connection attempts', false);
      return;
    }

    bucket.count += 1;
    callback(null, true);
  };
}
