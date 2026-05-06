import axios from 'axios';
import { getClientIp } from './getIpAddress.js';
import { Request } from 'express';
import { redisConnection } from '../db/connection.js';

const PROXYCHECK_API_KEY = process.env.PROXYCHECK_API_KEY;
const VPN_IP_CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

function isPrivateIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (ip.startsWith('fc00::') || ip.startsWith('fe80::')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

async function queryProxycheck(ip: string): Promise<boolean> {
  if (!PROXYCHECK_API_KEY) return false;
  try {
    const url = `https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=1&port=1&risk=1`;
    const { data } = await axios.get(url, { timeout: 5000 });
    const info = data[ip];
    return info?.proxy === 'yes' || info?.vpn === 'yes' || Number(info?.risk) > 0;
  } catch (err) {
    console.error('VPN check error, allowing request:', err);
    return false;
  }
}

/**
 * Checks if an IP is a VPN/proxy, with Redis caching (TTL 30 days).
 * Returns false for private IPs or if PROXYCHECK_API_KEY is not set.
 */
export async function isIpVpn(ip: string): Promise<boolean> {
  if (isPrivateIp(ip)) return false;
  if (!PROXYCHECK_API_KEY) return false;

  const cacheKey = `vpn:ip:${ip}`;
  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached !== null) return cached === '1';
  } catch {
    // Redis unavailable — fall through to live check
  }

  const isVpn = await queryProxycheck(ip);

  try {
    await redisConnection.setex(cacheKey, VPN_IP_CACHE_TTL, isVpn ? '1' : '0');
  } catch {
    // Redis unavailable — skip caching
  }

  return isVpn;
}

/**
 * Detects VPN for the request IP with Redis caching.
 * Use this for per-request checks to avoid hitting the external API on every call.
 */
export async function isVpnRequest(req: Request): Promise<boolean> {
  return isIpVpn(getClientIp(req));
}

/**
 * One-shot VPN detection for the login flow (no caching).
 * Result is stored as is_vpn in the user record.
 */
export async function detectVPN(req: Request): Promise<boolean> {
  const clientIp = getClientIp(req);

  if (isPrivateIp(clientIp)) return false;

  return queryProxycheck(clientIp);
}
