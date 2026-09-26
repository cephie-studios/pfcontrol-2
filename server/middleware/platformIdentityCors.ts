import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';

const PROD_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)*pfcontrol\.com$/i;
const DEV_ORIGINS = ['http://localhost:9901', 'http://localhost:5173'];

const BLOCKED_ORIGINS = new Set(['https://pilot.pfcontrol.com']);

function isBlockedOrigin(origin: string | undefined): boolean {
  return !!origin && BLOCKED_ORIGINS.has(origin.toLowerCase());
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin / non-browser requests carry no Origin header
  if (isBlockedOrigin(origin)) return false;
  if (process.env.NODE_ENV === 'production') {
    return PROD_ORIGIN_PATTERN.test(origin);
  }
  return DEV_ORIGINS.includes(origin);
}

function rejectBlockedOrigins(req: Request, res: Response, next: NextFunction) {
  if (isBlockedOrigin(req.get('origin'))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

export const platformIdentityCors = [
  rejectBlockedOrigins,
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Content-Type'],
  }),
];
