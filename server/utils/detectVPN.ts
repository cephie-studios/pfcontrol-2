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

const TOR_EXIT_LIST_URL = 'https://check.torproject.org/torbulkexitlist';
const TOR_CACHE_KEY = 'tor:exit-nodes';
const TOR_CACHE_TTL = 60 * 60; // 1 hour

export async function isTorExitNode(ip: string): Promise<boolean> {
  if (isPrivateIp(ip)) return false;

  try {
    // If IP is in the set it's a Tor exit node
    const isMember = await redisConnection.sismember(TOR_CACHE_KEY, ip);
    if (isMember === 1) return true;

    // If the set exists and is populated, IP is not a Tor exit node
    const size = await redisConnection.scard(TOR_CACHE_KEY);
    if (size > 0) return false;
  } catch {
    // Redis unavailable — fall through to live fetch
  }

  try {
    const response = await axios.get<string>(TOR_EXIT_LIST_URL, {
      timeout: 5000,
      responseType: 'text',
    });
    const ips = response.data
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    if (ips.length > 0) {
      try {
        const pipeline = redisConnection.pipeline();
        pipeline.del(TOR_CACHE_KEY);
        for (const exitIp of ips) {
          pipeline.sadd(TOR_CACHE_KEY, exitIp);
        }
        pipeline.expire(TOR_CACHE_KEY, TOR_CACHE_TTL);
        await pipeline.exec();
      } catch {
        // Redis unavailable — skip caching
      }
      return ips.includes(ip);
    }
  } catch (err) {
    console.error('Tor exit node list fetch failed, allowing request:', err);
  }

  return false;
}

const inflightChecks = new Map<string, Promise<boolean>>();

/**
 * Checks if an IP is a VPN/proxy/Tor exit node, with Redis caching (TTL 30 days).
 * Tor is checked first via the cached exit node list. If not Tor, falls through to
 * proxycheck. Deduplicates concurrent proxycheck calls for the same IP.
 */
export async function isIpVpn(ip: string): Promise<boolean> {
  if (isPrivateIp(ip)) return false;

  if (await isTorExitNode(ip)) return true;

  if (!PROXYCHECK_API_KEY) return false;

  const cacheKey = `vpn:ip:${ip}`;
  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached !== null) return cached === '1';
  } catch {
    // Redis unavailable — fall through to live check
  }

  const existing = inflightChecks.get(ip);
  if (existing) return existing;

  const promise = queryProxycheck(ip)
    .then(async (isVpn) => {
      try {
        await redisConnection.setex(cacheKey, VPN_IP_CACHE_TTL, isVpn ? '1' : '0');
      } catch {
        // Redis unavailable — skip caching
      }
      return isVpn;
    })
    .finally(() => {
      inflightChecks.delete(ip);
    });

  inflightChecks.set(ip, promise);
  return promise;
}

/**
 * Detects VPN/Tor for the request IP with Redis caching.
 * Use this for per-request checks to avoid hitting the external API on every call.
 */
export async function isVpnRequest(req: Request): Promise<boolean> {
  return isIpVpn(getClientIp(req));
}

/**
 * One-shot VPN/Tor detection for the login flow (no proxycheck caching).
 * Result is stored as is_vpn in the user record.
 */
export async function detectVPN(req: Request): Promise<boolean> {
  const clientIp = getClientIp(req);

  if (isPrivateIp(clientIp)) return false;

  if (await isTorExitNode(clientIp)) return true;

  return queryProxycheck(clientIp);
}
