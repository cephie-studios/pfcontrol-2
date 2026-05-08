import axios from 'axios';
import dns from 'dns/promises';
import { getClientIp } from './getIpAddress.js';
import { Request } from 'express';
import { redisConnection } from '../db/connection.js';

const PROXYCHECK_API_KEY = process.env.PROXYCHECK_API_KEY;
const VPN_IP_CACHE_TTL = 60 * 60 * 24 * 30; // 30 days
const TOR_CACHE_TTL = 60 * 60; // 1 hour
const TOR_DNS_TIMEOUT_MS = 3000;

// proxycheck.io type values that indicate anonymizing infrastructure
const BLOCKED_PROXY_TYPES = new Set([
  'Tor',
  'Tor Exit Node',
  'VPN',
  'SOCKS4',
  'SOCKS5',
  'SOCKS4A',
  'SOCKS5H',
  'HTTP Proxy',
  'HTTPS Proxy',
  'Web Proxy',
]);

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
    if (!info) return false;
    return (
      info.proxy === 'yes' ||
      info.vpn === 'yes' ||
      BLOCKED_PROXY_TYPES.has(info.type) ||
      Number(info.risk) > 0
    );
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

/**
 * Queries the Tor Project's DNSEL to check if an IP is an active exit node.
 *
 * IPv4: <reversed-octets>.dnsel.torproject.org
 * IPv6: <reversed-nibbles>.ip6.dnsel.torproject.org
 *
 * Returns 127.0.0.2 for confirmed exit nodes, NXDOMAIN for anything else.
 * Has a hard 3-second timeout so it never blocks the request path.
 *
 * This approach works for Tor exits running on any infrastructure (including
 * cloud providers like Cloudflare) as long as the exit is registered in the
 * Tor Project's database. The bulk exit list at check.torproject.org is IPv4
 * only, so IPv6 exits are invisible to it — the DNSEL handles both.
 */
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

    const addresses = await Promise.race([
      dns.resolve4(query),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DNS timeout')), TOR_DNS_TIMEOUT_MS)
      ),
    ]);
    return addresses.includes('127.0.0.2');
  } catch {
    // NXDOMAIN, timeout, or resolution failure = not a registered Tor exit node
    return false;
  }
}

/**
 * Checks if an IP is an active Tor exit node using Tor Project's DNSEL,
 * with per-IP Redis caching (TTL 1 hour). Works for both IPv4 and IPv6.
 */
export async function isTorExitNode(ip: string): Promise<boolean> {
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (isPrivateIp(normalized)) return false;

  const cacheKey = `tor:${normalized}`;
  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached !== null) return cached === '1';
  } catch {
    // Redis unavailable — fall through to live check
  }

  const isTor = await queryTorDns(normalized);

  try {
    await redisConnection.setex(cacheKey, TOR_CACHE_TTL, isTor ? '1' : '0');
  } catch {
    // Redis unavailable — skip caching
  }

  return isTor;
}

const inflightChecks = new Map<string, Promise<boolean>>();

/**
 * Checks if an IP is a VPN/proxy/Tor exit node, with Redis caching (TTL 30 days).
 * Tor is checked first via DNSEL (fast, no API key needed). Falls through to
 * proxycheck for VPN/proxy detection. Deduplicates concurrent proxycheck calls.
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
