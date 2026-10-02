import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

import { chartSubjectFor } from '../../../server/utils/chartSubject';

// Celesbit accepts 1-64 characters of letters, digits, dot, dash, underscore or at-sign, and
// rejects anything else outright, so whatever we send has to fit that shape.
const PERMITTED = /^[A-Za-z0-9._@-]{1,64}$/;

function request(
  user?: { userId: string },
  cookies: Record<string, string> = {}
) {
  return { user, cookies } as unknown as Request;
}

function response() {
  const cookie = vi.fn();
  return { res: { cookie } as unknown as Response, cookie };
}

describe('chartSubjectFor', () => {
  it('names a signed-in user by their id', () => {
    const { res } = response();
    expect(chartSubjectFor(request({ userId: '8812' }), res)).toBe('u8812');
  });

  it('does not set a cookie for a signed-in user', () => {
    const { res, cookie } = response();
    chartSubjectFor(request({ userId: '8812' }), res);
    expect(cookie).not.toHaveBeenCalled();
  });

  it('gives an anonymous visitor an id and remembers it', () => {
    const { res, cookie } = response();
    const subject = chartSubjectFor(request(), res);

    expect(subject).toMatch(/^a[0-9a-f]{32}$/);
    expect(cookie).toHaveBeenCalledWith(
      'chart_subject',
      subject,
      expect.objectContaining({ httpOnly: true })
    );
  });

  it('reuses the anonymous id it already gave out', () => {
    const { res, cookie } = response();
    const existing = `a${'0'.repeat(32)}`;

    expect(
      chartSubjectFor(request(undefined, { chart_subject: existing }), res)
    ).toBe(existing);
    expect(cookie).not.toHaveBeenCalled();
  });

  it('two anonymous visitors are not the same subject', () => {
    const { res } = response();
    expect(chartSubjectFor(request(), res)).not.toBe(
      chartSubjectFor(request(), res)
    );
  });

  it('replaces a cookie that has been tampered with', () => {
    // Otherwise a visitor could choose to be marked as somebody else, or send something upstream
    // will reject and lose charts for themselves.
    const { res, cookie } = response();
    const subject = chartSubjectFor(
      request(undefined, { chart_subject: 'not a valid subject!' }),
      res
    );

    expect(subject).toMatch(/^a[0-9a-f]{32}$/);
    expect(cookie).toHaveBeenCalled();
  });

  it('a signed-in user is never confused with an anonymous one', () => {
    const { res } = response();
    const user = chartSubjectFor(request({ userId: '1' }), res);
    const anonymous = chartSubjectFor(request(), res);

    expect(user.startsWith('u')).toBe(true);
    expect(anonymous.startsWith('a')).toBe(true);
    expect(user).not.toBe(anonymous);
  });

  it.each([
    { userId: '8812' },
    { userId: 'abc-123' },
    { userId: '0'.repeat(63) },
  ])('sends something upstream will accept for %o', (user) => {
    const { res } = response();
    expect(chartSubjectFor(request(user), res)).toMatch(PERMITTED);
  });

  it('falls back rather than sending a user id upstream would reject', () => {
    // A long or oddly shaped id would be a 400 from Celesbit and no charts at all; an anonymous
    // id still works and still marks the plate with somebody.
    const { res } = response();
    const subject = chartSubjectFor(request({ userId: 'x'.repeat(200) }), res);

    expect(subject).toMatch(PERMITTED);
    expect(subject).toMatch(/^a[0-9a-f]{32}$/);
  });
});
