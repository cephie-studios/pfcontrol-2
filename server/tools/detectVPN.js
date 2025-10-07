import axios from 'axios';
import { getClientIp } from './getIpAddress.js';

export async function detectVPN(req) {
    const clientIp = getClientIp(req);

    // Skip localhost/private IPs
    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.startsWith('192.168.') || clientIp.startsWith('10.') || clientIp.startsWith('172.') || clientIp.startsWith('fc00::') || clientIp.startsWith('fe80::')) {
        return false;
    }

    const response = await axios.get(`http://ip-api.com/json/${clientIp}?fields=proxy,hosting`, {
        timeout: 5000
    });

    const isVpn = response.data.proxy || response.data.hosting || false;
    return isVpn;
}