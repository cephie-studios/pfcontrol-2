import { decrypt, encrypt } from './encryption.js';

const ACCESS_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 16384;

export interface ExternalAcarsAccess {
  purpose: 'external-acars';
  sessionId: string;
  flightId: string;
  callsign: string;
  providerId: string;
  providerToken: string;
  acarsToken: string;
  expiresAt: number;
}

const REQUIRED_STRINGS = [
  'sessionId',
  'flightId',
  'callsign',
  'providerId',
  'providerToken',
  'acarsToken',
] as const;

export function createExternalAcarsAccess(
  input: Omit<ExternalAcarsAccess, 'purpose' | 'expiresAt'>,
  providerExpiry: string | null
): string {
  const providerExpiresAt = providerExpiry
    ? Date.parse(providerExpiry)
    : Infinity;
  if (Number.isNaN(providerExpiresAt) || providerExpiresAt <= Date.now()) {
    throw new Error('Provider returned an expired handoff');
  }

  const encrypted = encrypt({
    ...input,
    purpose: 'external-acars',
    expiresAt: Math.min(providerExpiresAt, Date.now() + ACCESS_TTL_MS),
  });
  if (!encrypted) throw new Error('Unable to protect ACARS access');
  return Buffer.from(JSON.stringify(encrypted)).toString('base64url');
}

export function readExternalAcarsAccess(
  token: string | undefined
): ExternalAcarsAccess | null {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  try {
    const value = decrypt(
      JSON.parse(Buffer.from(token, 'base64url').toString())
    ) as ExternalAcarsAccess | null;
    if (
      !value ||
      value.purpose !== 'external-acars' ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= Date.now() ||
      !REQUIRED_STRINGS.every(
        (key) => value[key] && typeof value[key] === 'string'
      )
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function defaultAcarsUrl(
  sessionId: string,
  flightId: string,
  acarsToken: string
): string {
  return `/acars/${encodeURIComponent(sessionId)}/${encodeURIComponent(flightId)}?acars_token=${encodeURIComponent(acarsToken)}`;
}

export function nativeFallbackUrl(
  sessionId: string,
  flightId: string,
  acarsToken: string
): string {
  return `${defaultAcarsUrl(sessionId, flightId, acarsToken)}&fallback=1`;
}
