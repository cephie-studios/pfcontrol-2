import { describe, expect, it } from 'vitest';
import {
  sanitizeInput,
  validateAccessId,
  validateCallsign,
  validateFlightId,
  validateFlightLevel,
  validateSessionId,
  validateSquawk,
  validateStand,
} from '../../../server/utils/validation.js';

describe('validateSessionId', () => {
  it('accepts an 8-character alphanumeric id', () => {
    expect(validateSessionId('Ab12Cd34')).toBe('Ab12Cd34');
  });

  it('rejects wrong length or characters', () => {
    expect(() => validateSessionId(undefined)).toThrow('Session ID is required');
    expect(() => validateSessionId('short')).toThrow('Invalid session ID format');
    expect(() => validateSessionId('toolonggg')).toThrow('Invalid session ID format');
    expect(() => validateSessionId('Ab12Cd3!')).toThrow('Invalid session ID format');
  });
});

describe('validateAccessId', () => {
  it('accepts a 64-char hex string', () => {
    const id = 'a'.repeat(64);
    expect(validateAccessId(id)).toBe(id);
  });

  it('rejects invalid access ids', () => {
    expect(() => validateAccessId(undefined)).toThrow('Access ID is required');
    expect(() => validateAccessId('gg'.repeat(32))).toThrow('Invalid access ID format');
  });
});

describe('validateFlightId', () => {
  it('accepts safe id strings', () => {
    expect(validateFlightId('f-1_2')).toBe('f-1_2');
  });

  it('rejects empty or invalid characters', () => {
    expect(() => validateFlightId('')).toThrow('Flight ID cannot be empty');
    expect(() => validateFlightId('bad id')).toThrow('Invalid flight ID format');
  });
});

describe('validateCallsign', () => {
  it('normalizes valid callsigns', () => {
    expect(validateCallsign('  dlh123  ')).toBe('DLH123');
  });

  it('rejects invalid callsigns', () => {
    expect(() => validateCallsign('')).toThrow('Callsign is required');
    expect(() => validateCallsign('A'.repeat(17))).toThrow(
      'Callsign must be 1-16 characters'
    );
    expect(() => validateCallsign('DLH-123')).toThrow(
      'Callsign can only contain letters and numbers'
    );
  });
});

describe('validateSquawk', () => {
  it('returns null for empty input', () => {
    expect(validateSquawk(null)).toBeNull();
    expect(validateSquawk('')).toBeNull();
  });

  it('accepts four octal digits', () => {
    expect(validateSquawk('7700')).toBe('7700');
  });

  it('rejects invalid squawk', () => {
    expect(() => validateSquawk('8800')).toThrow(
      'Squawk must be 4 octal digits (0-7)'
    );
  });
});

describe('validateFlightLevel', () => {
  it('rejects empty or non-numeric input', () => {
    expect(() => validateFlightLevel('')).toThrow(
      'Flight level must be between 0 and 660'
    );
  });

  it('accepts valid levels in steps of 5', () => {
    expect(validateFlightLevel('350')).toBe(350);
    expect(validateFlightLevel('0')).toBe(0);
    expect(validateFlightLevel('660')).toBe(660);
  });

  it('rejects out of range or wrong step', () => {
    expect(() => validateFlightLevel('661')).toThrow(
      'Flight level must be between 0 and 660'
    );
    expect(() => validateFlightLevel('352')).toThrow(
      'Flight level must be in 5-step increments'
    );
  });
});

describe('validateStand', () => {
  it('returns null when absent', () => {
    expect(validateStand(null)).toBeNull();
  });

  it('accepts alphanumeric stands up to length 8', () => {
    expect(validateStand('  A12  ')).toBe('A12');
  });

  it('rejects invalid stand', () => {
    expect(() => validateStand('A1-2')).toThrow(
      'Stand can only contain letters and numbers'
    );
    expect(() => validateStand('A'.repeat(9))).toThrow(
      'Stand must be 8 characters or less'
    );
  });
});

describe('sanitizeInput', () => {
  it('strips angle brackets and trims', () => {
    expect(sanitizeInput('  hello<world>  ')).toBe('helloworld');
  });

  it('passes through falsy unchanged', () => {
    expect(sanitizeInput(null)).toBeNull();
    expect(sanitizeInput(undefined)).toBeUndefined();
  });
});
