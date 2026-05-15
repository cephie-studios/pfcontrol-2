import { decrypt } from './encryption.js';

export interface PublicSessionAtis {
  letter?: string;
  text?: string;
}

export function parsePublicSessionAtis(atisRaw: unknown): PublicSessionAtis {
  if (!atisRaw) return {};

  try {
    const parsed = typeof atisRaw === 'string' ? JSON.parse(atisRaw) : atisRaw;
    const atis = decrypt(parsed);
    if (!atis || typeof atis !== 'object') return {};

    const letterRaw =
      'letter' in atis
        ? String((atis as { letter?: unknown }).letter ?? '')
        : '';
    const letter = letterRaw.trim().slice(0, 1).toUpperCase();

    const textRaw =
      'text' in atis ? String((atis as { text?: unknown }).text ?? '') : '';
    const text = textRaw.replace(/\s+/g, ' ').trim();

    return {
      ...(letter ? { letter } : {}),
      ...(text ? { text } : {}),
    };
  } catch {
    return {};
  }
}