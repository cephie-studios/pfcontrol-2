import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createExternalAcarsAccess,
  defaultAcarsUrl,
  readExternalAcarsAccess,
} from '../../../server/utils/externalAcarsAccess.js';

const input = {
  sessionId: 'Ab12Cd34',
  flightId: 'Fl12Gh34',
  callsign: 'BAW123',
  providerId: 'external-acars',
  providerToken: 'provider-token',
  acarsToken: 'tok',
};

afterEach(() => vi.useRealTimers());

describe('external ACARS access token', () => {
  it('round-trips and does not expose its contents', () => {
    const token = createExternalAcarsAccess(input, null);
    expect(token).not.toContain('provider-token');
    expect(Buffer.from(token, 'base64url').toString()).not.toContain(
      'provider-token'
    );
    expect(readExternalAcarsAccess(token)).toMatchObject(input);
  });

  it('expires after twelve hours', () => {
    vi.useFakeTimers();
    const token = createExternalAcarsAccess(input, null);
    vi.advanceTimersByTime(11 * 60 * 60 * 1000);
    expect(readExternalAcarsAccess(token)).not.toBeNull();
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    expect(readExternalAcarsAccess(token)).toBeNull();
  });

  it('expires with the provider handoff when that is sooner', () => {
    vi.useFakeTimers();
    const expiry = new Date(Date.now() + 60_000).toISOString();
    const token = createExternalAcarsAccess(input, expiry);
    vi.advanceTimersByTime(61_000);
    expect(readExternalAcarsAccess(token)).toBeNull();
  });

  it.each(['not-a-date', '2000-01-01T00:00:00Z'])(
    'refuses a provider expiry of %s',
    (expiry) => {
      expect(() => createExternalAcarsAccess(input, expiry)).toThrow();
    }
  );

  it.each([undefined, '', 'garbage', 'e30', 'x'.repeat(20000)])(
    'rejects a malformed token',
    (token) => {
      expect(readExternalAcarsAccess(token)).toBeNull();
    }
  );

  it('builds a native ACARS URL with an escaped token', () => {
    expect(defaultAcarsUrl('Ab12Cd34', 'Fl12Gh34', 'a b')).toBe(
      '/acars/Ab12Cd34/Fl12Gh34?acars_token=a%20b'
    );
  });
});
