import { afterEach, describe, expect, it } from 'vitest';
import type { Request } from 'express';

import { chartSubjectFor } from '../../../server/utils/chartSubject';

const SECRET = process.env.CHART_SUBJECT_SECRET;

function request(user?: { userId: string }) {
  return { user } as unknown as Request;
}

afterEach(() => {
  process.env.CHART_SUBJECT_SECRET = SECRET;
});

describe('chartSubjectFor', () => {
  it('returns a subject upstream accepts', () => {
    expect(chartSubjectFor(request({ userId: '8812' }))).toMatch(
      /^[0-9a-f]{32}$/
    );
  });

  it('is stable for one user', () => {
    expect(chartSubjectFor(request({ userId: '8812' }))).toBe(
      chartSubjectFor(request({ userId: '8812' }))
    );
  });

  it('differs between users', () => {
    expect(chartSubjectFor(request({ userId: '1' }))).not.toBe(
      chartSubjectFor(request({ userId: '2' }))
    );
  });

  it('does not leak the user id', () => {
    expect(chartSubjectFor(request({ userId: '8812' }))).not.toContain('8812');
  });

  it('differs under a different secret', () => {
    const before = chartSubjectFor(request({ userId: '8812' }));
    process.env.CHART_SUBJECT_SECRET = 'another-secret';
    expect(chartSubjectFor(request({ userId: '8812' }))).not.toBe(before);
  });

  it('returns null without a user', () => {
    expect(chartSubjectFor(request())).toBeNull();
  });

  it('returns null without a secret', () => {
    delete process.env.CHART_SUBJECT_SECRET;
    expect(chartSubjectFor(request({ userId: '8812' }))).toBeNull();
  });
});
