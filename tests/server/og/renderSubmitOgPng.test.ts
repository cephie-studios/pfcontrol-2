import { describe, expect, it, vi } from 'vitest';
import type { PublicSubmitSession } from '../../../server/services/publicSubmitSession.js';
import { buildSubmitOgCardProps } from '../../../server/og/renderSubmitOgPng.js';

const icons = {
  runway: 'data:image/png;base64,runway',
  atis: 'data:image/png;base64,atis',
  flights: 'data:image/png;base64,flights',
};

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
  it('includes icon detail rows and ATIS snippet', () => {
    const props = buildSubmitOgCardProps(session, null, icons);

    expect(props.airportIcao).toBe('LCPH');
    expect(props.networkLabel).toBe('PFATC');
    expect(props.atisLetter).toBe('B');
    expect(props.details.map((d) => d.label)).toEqual([
      'Active runway',
      'ATIS',
      'Flights',
      'Controller',
    ]);
    expect(props.atisSnippet).toContain('RWY 29 IN USE');
  });
});