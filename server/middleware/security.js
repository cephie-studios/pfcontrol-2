// middlewares/security.js
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15min
    max: 5, // max 5 login attempts per IP
    message: 'Too many login attempts, try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

const securityMiddleware = [
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "https://cdn.discordapp.com"],
            },
        },
    }),
];

export { authLimiter, securityMiddleware };