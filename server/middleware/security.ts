import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { RequestHandler, Response } from 'express';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15min
  max: 15,
  message: 'Too many login attempts, try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const cspNonce: RequestHandler = (_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
};

const securityMiddleware = [
  cspNonce,
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: [
          "'self'",
          (_req, res) =>
            `'nonce-${(res as unknown as Response).locals.cspNonce}'`,
          "'sha256-eIXWvAmxkr251LJZkjniEK5LcPF3NkapbJepohwYRIc='",
          "'sha256-SaCkFfPruIdTXT8/97JArQmGxiJAL2o4bBDvSgJ5y3Q='",
          'https://tpfcu.pfcontrol.com',
        ],
        connectSrc: [
          "'self'",
          'https://tpfcu.pfcontrol.com',
          'https://api.cephie.app',
          'https://us.i.posthog.com',
          'https://us.posthog.com',
        ],
        frameSrc: ["'self'", 'https://status.cephie.app'],
        imgSrc: [
          "'self'",
          'https://cdn.discordapp.com',
          'https://api.cephie.app',
          'https://ui-avatars.com',
        ],
      },
    },
  }),
];

export { authLimiter, securityMiddleware };
