export function sanitizeString(input, maxLength = 500) {
    if (typeof input !== 'string') {
        return '';
    }

    let sanitized = input
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();

    if (maxLength && sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
}

export function sanitizeCallsign(callsign) {
    if (typeof callsign !== 'string') return '';
    return callsign
        .replace(/[^A-Za-z0-9\-]/g, '')
        .substring(0, 16);
}

export function sanitizeAirportCode(code) {
    if (typeof code !== 'string') return '';
    return code
        .replace(/[^A-Za-z]/g, '')
        .substring(0, 4)
        .toUpperCase();
}

export function sanitizeAlphanumeric(input, maxLength = 50) {
    if (typeof input !== 'string') return '';
    return input
        .replace(/[^A-Za-z0-9\s\-_]/g, '')
        .trim()
        .substring(0, maxLength);
}

export function sanitizeRunway(runway) {
    if (typeof runway !== 'string') return '';
    return runway
        .replace(/[^A-Za-z0-9]/g, '')
        .substring(0, 10)
        .toUpperCase();
}

export function sanitizeSquawk(squawk) {
    if (typeof squawk !== 'string') return '';
    return squawk
        .replace(/[^0-7]/g, '')
        .substring(0, 4);
}

export function sanitizeFlightLevel(fl) {
    if (typeof fl !== 'string') return '';
    return fl
        .replace(/[^0-9A-Za-z]/g, '')
        .substring(0, 8)
        .toUpperCase();
}

export function sanitizeMessage(message, maxLength = 500) {
    if (typeof message !== 'string') return '';

    let sanitized = message
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();

    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
}
