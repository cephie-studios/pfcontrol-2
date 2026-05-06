import axios from 'axios';
import { getClientIp } from './getIpAddress.js';
import { Request } from 'express';
import { redisConnection } from '../db/connection.js';

const PROXYCHECK_API_KEY = process.env.PROXYCHECK_API_KEY;
const VPN_IP_CACHE_TTL = 3600; // 1 hour

const PRIVATE_PREFIXES = ['10.', '192.168.', '172.16.', '172.31.', 'fc00::', 'fe80::'];

function isPrivateIp(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    PRIVATE_PREFIXES.some((p) => ip.startsWith(p))
  );
}

/**
 * Checks if an IP is a VPN/proxy, with Redis caching (TTL 1 hour).
 * Returns false for private IPs or if PROXYCHECK_API_KEY is not set.
 */
export async function isIpVpn(ip: string): Promise<boolean> {
  if (isPrivateIp(ip)) return false;
  if (!PROXYCHECK_API_KEY) return false;

  const cacheKey = `vpn:ip:${ip}`;
  const cached = await redisConnection.get(cacheKey);
  if (cached !== null) return cached === '1';

  try {
    const url = `https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=1&port=1&risk=1`;
    const { data } = await axios.get(url, { timeout: 5000 });
    const info = data[ip];
    const isVpn = !!(info?.proxy === 'yes' || info?.vpn === 'yes' || Number(info?.risk) > 0);
    await redisConnection.setex(cacheKey, VPN_IP_CACHE_TTL, isVpn ? '1' : '0');
    return isVpn;
  } catch {
    return false;
  }
}

export async function detectVPN(req: Request): Promise<boolean> {
  const clientIpRaw = getClientIp(req);
  const clientIp = Array.isArray(clientIpRaw) ? clientIpRaw[0] : clientIpRaw;
  return isIpVpn(clientIp);
}
