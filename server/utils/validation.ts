export function validateSessionId(sessionId: string | undefined) {
    if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Session ID is required');
    }

    if (!/^[A-Za-z0-9]{8}$/.test(sessionId)) {
        throw new Error('Invalid session ID format');
    }

    return sessionId;
}

export function validateAccessId(accessId: unknown) {
    if (!accessId || typeof accessId !== 'string') {
        throw new Error('Access ID is required');
    }

    if (!/^[a-f0-9]{64}$/.test(accessId)) {
        throw new Error('Invalid access ID format');
    }

    return accessId;
}

export function validateFlightId(flightId: unknown) {
    if (flightId === undefined || flightId === null) {
        throw new Error('Flight ID is required');
    }

    const id = String(flightId).trim();

    if (id.length === 0) {
        throw new Error('Flight ID cannot be empty');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        throw new Error('Invalid flight ID format');
    }

    return id;
}

export function validateCallsign(callsign: unknown) {
    if (!callsign || typeof callsign !== 'string') {
        throw new Error('Callsign is required');
    }

    const trimmed = callsign.trim();

    if (trimmed.length === 0 || trimmed.length > 16) {
        throw new Error('Callsign must be 1-16 characters');
    }

    if (!/^[A-Z0-9]+$/i.test(trimmed)) {
        throw new Error('Callsign can only contain letters and numbers');
    }

    return trimmed.toUpperCase();
}

export function validateSquawk(squawk: unknown) {
    if (!squawk) return null;

    const trimmed = squawk.toString().trim();

    if (!/^[0-7]{4}$/.test(trimmed)) {
        throw new Error('Squawk must be 4 octal digits (0-7)');
    }

    return trimmed;
}

export function validateFlightLevel(fl: string) {
    if (fl === undefined || fl === null) return null;

    const level = parseInt(fl, 10);

    if (isNaN(level) || level < 0 || level > 660) {
        throw new Error('Flight level must be between 0 and 660');
    }

    if (level % 5 !== 0) {
        throw new Error('Flight level must be in 5-step increments (e.g., 350, 355, 360)');
    }

    return level;
}

export function validateStand(stand: unknown) {
    if (!stand) return null;

    const trimmed = stand.toString().trim();

    if (trimmed.length > 8) {
        throw new Error('Stand must be 8 characters or less');
    }

    return trimmed;
}

export function validateRemark(remark: unknown) {
    if (!remark) return null;

    const trimmed = remark.toString().trim();

    if (trimmed.length > 255) {
        throw new Error('Remark must be 255 characters or less');
    }

    return trimmed;
}

export function sanitizeInput(input: unknown) {
    if (!input) return input;

    return input
        .toString()
        .replace(/[<>]/g, '')
        .trim();
}
