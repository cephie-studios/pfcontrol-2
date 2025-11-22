import { Request } from 'express';

export function getClientIp(req: Request) {
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'];
  }

  if (req.headers['x-forwarded-for']) {
    const forwarded = req.headers['x-forwarded-for'];
    if (Array.isArray(forwarded)) {
      return forwarded[0].trim();
    }
    return forwarded.split(',')[0].trim();
  }

  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
}
