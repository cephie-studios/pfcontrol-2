import axios from 'axios';
import dns from 'dns/promises';
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

// Expands a compressed IPv6 address to full 8-group notation.
// e.g. "2405:8100:8000:5ca1::66:1fab" → "2405:8100:8000:5ca1:0000:0000:0066:1fab"
function expandIPv6(ip: string): string {
  const halves = ip.split('::');
  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const fill = Array(8 - left.length - right.length).fill('0000');
    return [...left, ...fill, ...right].map((g) => g.padStart(4, '0')).join(':');
  }
  return ip.split(':').map((g) => g.padStart(4, '0')).join(':');
}

const TOR_EXIT_LIST_URL = 'https://check.torproject.org/torbulkexitlist';
const TOR_IPV4_CACHE_KEY = 'tor:exit-nodes';
const TOR_DNS_CACHE_TTL = 60 * 60; // 1 hour

// DNS-based Tor exit check — used for IPv6 (no bulk list available) and as
// fallback for IPv4 when the bulk list isn't cached yet.
// Queries Tor's DNSEL: {reversed}.dnsel.torproject.org (IPv4)
//                   or {reversed-nibbles}.ip6.dnsel.torproject.org (IPv6)
// Returns 127.0.0.2 if confirmed exit node.
async function queryTorDns(ip: string): Promise<boolean> {
  try {
    let query: string;
    if (ip.includes(':')) {
      const expanded = expandIPv6(ip);
      const nibbles = expanded.replace(/:/g, '').split('').reverse().join('.');
      query = `${nibbles}.ip6.dnsel.torproject.org`;
    } else {
      const reversed = ip.split('.').reverse().join('.');
      query = `${reversed}.dnsel.torproject.org`;
    }
    const addresses = await dns.resolve4(query);
    return addresses.includes('127.0.0.2');
  } catch {
    // NXDOMAIN or resolution failure = not a Tor exit node
    return false;
  }
}

export async function isTorExitNode(ip: string): Promise<boolean> {
  // Normalize IPv6-mapped IPv4 (e.g. ::ffff:1.2.3.4 → 1.2.3.4)
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (isPrivateIp(normalized)) return false;

  const isIPv6 = normalized.includes(':');

  if (isIPv6) {
    // No bulk list for IPv6 — use DNS check with Redis caching
    const cacheKey = `tor:dns:${normalized}`;
    try {
      const cached = await redisConnection.get(cacheKey);
      if (cached !== null) return cached === '1';
    } catch {
      // Redis unavailable — fall through to live DNS
    }
    const isTor = await queryTorDns(normalized);
    try {
      await redisConnection.setex(cacheKey, TOR_DNS_CACHE_TTL, isTor ? '1' : '0');
    } catch {
      // Redis unavailable — skip caching
    }
    return isTor;
  }

  // IPv4 — check bulk list cached in Redis set
  try {
    const isMember = await redisConnection.sismember(TOR_IPV4_CACHE_KEY, normalized);
    if (isMember === 1) return true;

    const size = await redisConnection.scard(TOR_IPV4_CACHE_KEY);
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
        pipeline.del(TOR_IPV4_CACHE_KEY);
        for (const exitIp of ips) {
          pipeline.sadd(TOR_IPV4_CACHE_KEY, exitIp);
        }
        pipeline.expire(TOR_IPV4_CACHE_KEY, TOR_DNS_CACHE_TTL);
        await pipeline.exec();
      } catch {
        // Redis unavailable — skip caching
      }
      return ips.includes(normalized);
    }
  } catch (err) {
    console.error('Tor exit node list fetch failed, allowing request:', err);
  }

  return false;
}

const inflightChecks = new Map<string, Promise<boolean>>();

/**
 * Checks if an IP is a VPN/proxy/Tor exit node, with Redis caching (TTL 30 days).
 * Tor is checked first (bulk list for IPv4, DNS for IPv6). Falls through to
 * proxycheck if not detected as Tor. Deduplicates concurrent proxycheck calls.
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
