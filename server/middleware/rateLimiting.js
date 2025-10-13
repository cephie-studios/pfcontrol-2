import rateLimit from 'express-rate-limit';

export const sessionCreationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Too many sessions created. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const flightCreationLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: { error: 'Too many flights submitted. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const acarsValidationLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    message: { error: 'Too many ACARS validation requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const generalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const chatMessageLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    message: { error: 'Too many messages. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});
