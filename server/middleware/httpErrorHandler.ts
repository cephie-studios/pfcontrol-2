import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/posthog.js';

function getHttpStatus(err: unknown): number {
  if (!err || typeof err !== 'object') return 500;
  const o = err as Record<string, unknown>;
  const raw = o.status ?? o.statusCode ?? o.status_code;
  if (typeof raw === 'number' && raw >= 400 && raw < 600) return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    if (!Number.isNaN(n) && n >= 400 && n < 600) return n;
  }
  const output = o.output as { statusCode?: number } | undefined;
  if (
    output &&
    typeof output.statusCode === 'number' &&
    output.statusCode >= 400 &&
    output.statusCode < 600
  ) {
    return output.statusCode;
  }
  return 500;
}

export function httpErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (res.headersSent) return;

  const status = getHttpStatus(err);
  const isProd = process.env.NODE_ENV === 'production';

  if (status >= 500) {
    logger.error('Unhandled server error', {
      status,
      method: req.method,
      path: req.originalUrl,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (req.originalUrl.startsWith('/api')) {
    const clientSafe =
      status < 500 && err instanceof Error && err.message
        ? err.message
        : !isProd && err instanceof Error
          ? err.message
          : 'Internal server error';
    res.status(status).json({ error: clientSafe });
    return;
  }

  res
    .status(status >= 500 ? 500 : status)
    .type('text/plain')
    .send(
      isProd
        ? 'Something went wrong'
        : err instanceof Error
          ? err.message
          : 'Error'
    );
}
