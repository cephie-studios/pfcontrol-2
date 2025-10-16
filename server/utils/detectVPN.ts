import axios from 'axios';
import { getClientIp } from './getIpAddress.js';
import { Request } from 'express';

const PROXYCHECK_API_KEY = process.env.PROXYCHECK_API_KEY;

export async function detectVPN(req: Request): Promise<boolean> {
  const clientIpRaw = getClientIp(req);
  const clientIp = Array.isArray(clientIpRaw) ? clientIpRaw[0] : clientIpRaw;

  if (
    clientIp === '127.0.0.1' ||
    clientIp === '::1' ||
    clientIp.startsWith('10.') ||
    clientIp.startsWith('192.168.') ||
    clientIp.startsWith('172.16.') ||
    clientIp.startsWith('172.31.') ||
    clientIp.startsWith('fc00::') ||
    clientIp.startsWith('fe80::')
  ) {
    return false;
  }

  if (!PROXYCHECK_API_KEY) {
    return false;
  }

  try {
    const url = `https://proxycheck.io/v2/${clientIp}?key=${PROXYCHECK_API_KEY}&vpn=1&port=1&risk=1`;
    const { data } = await axios.get(url, { timeout: 5000 });
    const info = data[clientIp];

    if (info?.proxy === "yes" || info?.vpn === "yes" || Number(info?.risk) > 0) {
      return true;
    }
  } catch (err) {
    console.error("VPN check error, allowing request:", err);
  }

  return false;
}