import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../../../server/db/connection.js', () => ({
  mainDb: {},
  redisConnection: {},
}));

import { effectiveKeyScopes } from '../../../server/db/developer.js';

describe('effectiveKeyScopes', () => {
  it('merges key scopes with all-keys scopes', () => {
    expect(
      effectiveKeyScopes(['a', 'b'], ['a', 'b', 'c'], ['c']).sort()
    ).toEqual(['a', 'b', 'c']);
  });

  it('gives a key with no own scopes the all-keys scopes', () => {
    expect(effectiveKeyScopes([], ['a', 'c'], ['c'])).toEqual(['c']);
  });

  it('drops anything the profile no longer allows', () => {
    expect(effectiveKeyScopes(['a', 'x'], ['a'], ['y'])).toEqual(['a']);
  });

  it('does not duplicate a scope that is on the key and all-keys', () => {
    expect(effectiveKeyScopes(['a'], ['a'], ['a'])).toEqual(['a']);
  });

  it('accepts JSON-string columns', () => {
    expect(effectiveKeyScopes('["a"]', '["a","b"]', '["b"]').sort()).toEqual([
      'a',
      'b',
    ]);
  });

  it('treats missing or malformed values as empty', () => {
    expect(effectiveKeyScopes(null, undefined, 'not json')).toEqual([]);
  });
});
