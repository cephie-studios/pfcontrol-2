import type { Request, Response, NextFunction } from 'express';
import { getClientIp } from '../utils/getIpAddress.js';
import { hashIp } from '../utils/encryption.js';
import {
  hashDeveloperApiKeySecret,
  isSupportedDeveloperApiKeySecretFormat,
} from '../developer/apiKeySecret.js';
import {
  findActiveDeveloperKeyBySecretHash,
  insertDeveloperApiUsage,
  touchDeveloperApiKeyLastUsed,
} from '../db/developer.js';
import { matchExtDeveloperRoute } from '../developer/extRoutes.js';
import { redisConnection } from '../db/connection.js';

function extractApiSecret(req: Request): string | null {
  const auth = req.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    const v = auth.slice(7).trim();
    if (v) return v;
  }
  const x = req.get('x-api-key');
  if (x?.trim()) return x.trim();
  return null;
}

function parseScopesFromKey(scopes: unknown): string[] {
  if (Array.isArray(scopes))
    return scopes.filter((s): s is string => typeof s === 'string');
  if (typeof scopes === 'string') {
    try {
      const p = JSON.parse(scopes) as unknown;
      if (Array.isArray(p))
        return p.filter((s): s is string => typeof s === 'string');
    } catch {
      // ignore
    }
  }
  return [];
}

export function developerExtUsageLifecycle(
  req: Request,
  res: Response,
  next: NextFunction
) {
  req.developerExtStartedAt = Date.now();
  res.on('finish', () => {
    const ext = req.developerExt;
    const started = req.developerExtStartedAt;
    if (!ext?.keyId || !ext.matchedScopeId || started == null) return;
    const durationMs = Math.max(0, Date.now() - started);
    const ip = getClientIp(req);
    const validIp = ip && ip !== 'unknown' ? ip : null;
    const ipHash = validIp ? hashIp(validIp) : null;
    void insertDeveloperApiUsage({
      keyId: ext.keyId,
      userId: ext.userId,
      scopeId: ext.matchedScopeId,
      method: req.method,
      path: ext.matchedPath || req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      durationMs,
      ipHash,
      clientIp: validIp,
    });
    if (res.statusCode < 500) {
      void touchDeveloperApiKeyLastUsed(ext.keyId);
    }
  });
  next();
}

export async function developerExtApiAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const secret = extractApiSecret(req);
    if (!secret || !isSupportedDeveloperApiKeySecretFormat(secret)) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    const secretHash = hashDeveloperApiKeySecret(secret);
    const row = await findActiveDeveloperKeyBySecretHash(secretHash);
    if (!row) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    const scopes = parseScopesFromKey(row.key.scopes);
    req.developerExt = {
      keyId: String(row.key.id),
      userId: row.key.user_id,
      scopes,
      matchedScopeId: null,
      matchedPath: '',
      keyPrefix: row.key.prefix,
      keyName: row.key.name,
      rateLimitPerMinute: row.rateLimitPerMinute,
    };
    next();
  } catch (e) {
    next(e);
  }
}

export function getDeveloperExtPath(req: Request): string {
  const raw = (req.path || '/').split('?')[0];
  if (!raw || raw === '') return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export async function developerExtScopeGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const ext = req.developerExt;
    if (!ext) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    const path = getDeveloperExtPath(req);
    const scopeId = matchExtDeveloperRoute(req.method, path);
    if (!scopeId) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!ext.scopes.includes(scopeId)) {
      return res
        .status(403)
        .json({ error: 'This API key is not allowed to access this endpoint' });
    }
    ext.matchedScopeId = scopeId;
    ext.matchedPath = path;
    next();
  } catch (e) {
    next(e);
  }
}

// @deprecated Use developerExtScopeGuard (matches all /api/ext/v1 routes).
export const developerExtDataGuard = developerExtScopeGuard;

const RPM_FLOOR = 10;

export function getDeveloperApiDefaultRateLimitPerMinute(): number {
  const envDefault = Number(process.env.DEVELOPER_API_RATE_LIMIT_PER_MINUTE);
  return Number.isFinite(envDefault) && envDefault > 0 ? envDefault : 120;
}

export async function developerExtRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const ext = req.developerExt;
  if (!ext?.keyId) return next();
  const fallback = getDeveloperApiDefaultRateLimitPerMinute();
  const perKey = ext.rateLimitPerMinute;
  const raw =
    perKey != null && Number.isFinite(perKey) && perKey > 0
      ? Math.floor(perKey)
      : fallback;
  const max = Math.max(RPM_FLOOR, raw);
  const windowStart = Math.floor(Date.now() / 60_000);
  const rkey = `devapi:rl:${ext.keyId}:${windowStart}`;
  try {
    const n = await redisConnection.incr(rkey);
    if (n === 1) {
      await redisConnection.expire(rkey, 70);
    }
    if (n > max) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
  } catch (e) {
    console.warn('[developerExtRateLimit] Redis error:', e);
  }
  next();
}
