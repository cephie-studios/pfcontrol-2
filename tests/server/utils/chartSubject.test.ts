import { describe, expect, it } from 'vitest';
import type { Request } from 'express';

import { chartSubjectFor } from '../../../server/utils/chartSubject';

// Celesbit accepts 1-64 characters of letters, digits, dot, dash, underscore or at-sign, and
// rejects anything else outright, so whatever we send has to fit that shape.
const PERMITTED = /^[A-Za-z0-9._@-]{1,64}$/;

function request(user?: { userId: string }) {
  return { user } as unknown as Request;
}

describe('chartSubjectFor', () => {
  it('names a signed-in user by their id', () => {
    expect(chartSubjectFor(request({ userId: '8812' }))).toBe('u8812');
  });

  it('names two users differently', () => {
    expect(chartSubjectFor(request({ userId: '1' }))).not.toBe(
      chartSubjectFor(request({ userId: '2' }))
    );
  });

  it('refuses a request with no user behind it', () => {
    // A recipient we cannot tie back to anybody is not worth marking a plate with, and the route
    // turns this into a 401 rather than fetching a chart nobody is answerable for.
    expect(chartSubjectFor(request())).toBeNull();
  });

  it.each([
    { userId: '8812' },
    { userId: 'abc-123' },
    { userId: '0'.repeat(63) },
  ])('sends something upstream will accept for %o', (user) => {
    expect(chartSubjectFor(request(user))).toMatch(PERMITTED);
  });

  it('refuses a user id upstream would reject rather than sending it', () => {
    // Too long for Celesbit, which would answer 400. Better to fail here, where the reason is
    // obvious, than to have charts quietly stop working for that one account.
    expect(chartSubjectFor(request({ userId: 'x'.repeat(200) }))).toBeNull();
  });

  it('refuses a user id carrying characters the identity cannot hold', () => {
    expect(chartSubjectFor(request({ userId: 'has:colon' }))).toBeNull();
  });
});
