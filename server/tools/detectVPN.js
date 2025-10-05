import axios from 'axios';

export async function detectVPN(ip) {
    try {
        // Skip localhost/private IPs (handle both IPv4 and IPv6)
        if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.') || ip.startsWith('fc00::') || ip.startsWith('fe80::')) {
            console.log(`VPN detection skipped for localhost/private IP: ${ip}`);
            return false;
        }

        const response = await axios.get(`http://ip-api.com/json/${ip}?fields=proxy,hosting`, {
            timeout: 5000
        });

        const isVpn = response.data.proxy || response.data.hosting || false;
        return isVpn;
    } catch (error) {
        console.error('VPN detection error for IP:', ip, error);
        return false;
    }
}
