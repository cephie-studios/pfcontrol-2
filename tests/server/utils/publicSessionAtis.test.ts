import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/utils/encryption.js', () => ({
  decrypt: vi.fn((value: unknown) => value),
}));

import { parsePublicSessionAtis } from '../../../server/utils/publicSessionAtis.js';

describe('parsePublicSessionAtis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty when ATIS is missing', () => {
    expect(parsePublicSessionAtis(null)).toEqual({});
  });

  it('parses letter and text from object ATIS', () => {
    expect(
      parsePublicSessionAtis({
        letter: 'b',
        text: 'LCPH ATIS B.\nRWY 29 IN USE.',
      })
    ).toEqual({
      letter: 'B',
      text: 'LCPH ATIS B. RWY 29 IN USE.',
    });
  });

  it('parses JSON string ATIS payloads', () => {
    expect(
      parsePublicSessionAtis(
        JSON.stringify({ letter: 'A', text: '  hello   world  ' })
      )
    ).toEqual({
      letter: 'A',
      text: 'hello world',
    });
  });
});