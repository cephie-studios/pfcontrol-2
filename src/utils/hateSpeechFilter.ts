import leoProfanity from 'leo-profanity';

try {
    leoProfanity.loadDictionary('en');
} catch {
    // ignore
}

function normalizeForProfanity(s: string) {
    return s
        .toLowerCase()
        .replace(/[\s\-_@*#$%.,!?]+/g, '')
        .replace(/[0o]/g, 'o')
        .replace(/[1il!]/g, 'i')
        .replace(/[3e]/g, 'e')
        .replace(/[4a@]/g, 'a')
        .replace(/[5s$]/g, 's')
        .replace(/[7t]/g, 't')
        .replace(/[9g]/g, 'g');
}

export function containsProfanity(message: string): boolean {
    if (!message || typeof message !== 'string') return false;
    const raw = message.toLowerCase().trim();

    try {
        if (leoProfanity.check(raw)) return true;
    } catch {}

    const norm = normalizeForProfanity(raw);
    try {
        return leoProfanity.check(norm);
    } catch {
        return false;
    }
}

export function containsHateSpeech(message: string): boolean {
    return containsProfanity(message);
}

export function getHateSpeechReason(message: string): string {
    if (containsProfanity(message)) return 'Profanity detected';
    return 'No hate speech detected';
}