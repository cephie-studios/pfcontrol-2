import jwt from 'jsonwebtoken';
import { getUserById } from '../db/users.js';
import { isAdmin } from './admin.js';
import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from '../types/JwtPayload.js';
import { isUserBanned, isIpBanned, BAN_CACHE_TTL } from '../db/ban.js';
import { getClientIp } from '../utils/getIpAddress.js';
import { isIpVpn } from '../utils/detectVPN.js';
import { isVpnException, isVpnGateEnabled } from '../db/vpnExceptions.js';
import { redisConnection } from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Validates JWT and populates req.user without enforcing ban or VPN gate.
 * Use only on routes that need to report ban/VPN status back to the client.
 */
export async function requireAuthSoft(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'JWT secret not configured' });
    }
    const decoded = jwt.verify(token, JWT_SECRET as string) as JwtPayload;
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      discriminator: decoded.discriminator,
      avatar: decoded.avatar,
      isAdmin: isAdmin(decoded.userId),
      iat: decoded.iat,
      exp: decoded.exp,
    };
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export default async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'JWT secret not configured' });
    }
    const decoded = jwt.verify(token, JWT_SECRET as string) as JwtPayload;
    const user = await getUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Extract client IP once — used for both IP ban and VPN checks
    const ip = getClientIp(req);

    // User ID ban check — only cache confirmed bans ('1') to avoid race with banUser
    const banCacheKey = `ban:${decoded.userId}`;
    let isBanned: boolean;
    const cachedBan = await redisConnection.get(banCacheKey);
    if (cachedBan === '1') {
      isBanned = true;
    } else {
      const banRecord = await isUserBanned(decoded.userId);
      isBanned = !!banRecord;
      if (isBanned) {
        await redisConnection.setex(banCacheKey, BAN_CACHE_TTL, '1');
      }
    }

    // IP ban check — only cache confirmed bans ('1')
    const validIp = ip && ip !== 'unknown' ? ip : null;
    if (!isBanned && validIp) {
      const ipBanCacheKey = `ban:ip:${validIp}`;
      const cachedIpBan = await redisConnection.get(ipBanCacheKey);
      if (cachedIpBan === '1') {
        isBanned = true;
      } else {
        const ipBanRecord = await isIpBanned(validIp);
        isBanned = !!ipBanRecord;
        if (isBanned) {
          await redisConnection.setex(ipBanCacheKey, BAN_CACHE_TTL, '1');
        }
      }
    }

    if (isBanned) {
      return res.status(403).json({ error: 'Account is banned' });
    }

    // VPN gate check — block if stored flag OR current IP is detected as VPN
    const gateEnabled = await isVpnGateEnabled();
    if (gateEnabled) {
      if (user.is_vpn || (validIp && await isIpVpn(validIp))) {
        const hasException = await isVpnException(decoded.userId);
        if (!hasException) {
          return res.status(403).json({ error: 'VPN access blocked' });
        }
      }
    }

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      discriminator: decoded.discriminator,
      avatar: decoded.avatar,
      isAdmin: isAdmin(decoded.userId),
      iat: decoded.iat,
      exp: decoded.exp,
    };

    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
}
