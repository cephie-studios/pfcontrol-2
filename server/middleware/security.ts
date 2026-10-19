import crypto from 'crypto';
import rateLimit, {
  type RateLimitExceededEventHandler,
} from 'express-rate-limit';
import helmet from 'helmet';
import type { RequestHandler, Response } from 'express';

const AUTH_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15min
const AUTH_LIMIT_MAX = 15;

const authLimiter = rateLimit({
  windowMs: AUTH_LIMIT_WINDOW_MS,
  max: AUTH_LIMIT_MAX,
  message: 'Too many login attempts, try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

function createAuthLimiter(handler: RateLimitExceededEventHandler) {
  return rateLimit({
    windowMs: AUTH_LIMIT_WINDOW_MS,
    max: AUTH_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
  });
}

const cspNonce: RequestHandler = (_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
};

const securityMiddleware = [
  cspNonce,
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://*.posthog.com'],
        scriptSrc: [
          "'self'",
          (_req, res) =>
            `'nonce-${(res as unknown as Response).locals.cspNonce}'`,
          'https://tpfcu.pfcontrol.com',
          'https://pilot.pfcontrol.com',
          'https://*.posthog.com',
          'https://static.cloudflareinsights.com',
        ],
        connectSrc: [
          "'self'",
          'https://tpfcu.pfcontrol.com',
          'https://pilot.pfcontrol.com',
          'https://api.cephie.app',
          'https://*.posthog.com',
          'https://cloudflareinsights.com',
        ],
        frameSrc: ["'self'", 'https://status.cephie.app'],
        workerSrc: ["'self'", 'blob:'],
        imgSrc: [
          "'self'",
          'blob:',
          'https://cdn.discordapp.com',
          'https://api.cephie.app',
          'https://ui-avatars.com',
        ],
      },
    },
  }),
];

export { authLimiter, createAuthLimiter, securityMiddleware };
