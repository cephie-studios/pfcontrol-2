import { describe, expect, it } from 'vitest';
import type { PublicSubmitSession } from '../../../server/services/publicSubmitSession.js';
import { buildSubmitOgCardProps } from '../../../server/og/renderSubmitOgPng.js';

const session: PublicSubmitSession = {
  sessionId: '9824e8cc',
  airportIcao: 'LCPH',
  activeRunway: '29',
  isPFATC: true,
  isAdvancedATC: false,
  createdBy: '1',
  flightCount: 22,
  atisLetter: 'B',
  atisText: 'LCPH ATIS B. RWY 29 IN USE.',
  controllerUsername: 'bananensammler_',
};

describe('buildSubmitOgCardProps', () => {
  it('maps session into profile-style stats plus INFO-prefixed ATIS snippet', () => {
    const props = buildSubmitOgCardProps(session, null);

    expect(props.airportIcao).toBe('LCPH');
    expect(props.networkLabel).toBe('PFATC');
    expect(props.stats.map((s) => s.label)).toEqual([
      'Active runway',
      'ATIS',
      'Flights',
      'Controller',
    ]);
    expect(props.atisSnippet?.startsWith('INFO B:')).toBe(true);
    expect(props.atisSnippet).toContain('RWY 29 IN USE');
  });
});
