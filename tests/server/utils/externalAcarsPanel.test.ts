import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hasActiveExternalAcarsClaim: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('../../../server/utils/externalAcarsClaims.js', () => ({
  hasActiveExternalAcarsClaim: mocks.hasActiveExternalAcarsClaim,
}));

import { resolveExternalAcarsRedirectUrl } from '../../../server/utils/externalAcarsPanel.js';

const flight = { callsign: 'BAW123', acars_token: 'tok' };
const panelUrl = 'https://pilot.pfcontrol.com/panel/abc';

function panelResponse(url: string) {
  return { ok: true, json: async () => ({ url }) };
}

describe('resolveExternalAcarsRedirectUrl', () => {
  beforeEach(() => {
    vi.stubEnv('PILOT_ACARS_PANEL_API_KEY', 'secret');
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.fetch.mockReset();
    mocks.hasActiveExternalAcarsClaim.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('redirects external sessions without checking claims', async () => {
    mocks.fetch.mockResolvedValue(panelResponse(panelUrl));
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', external_session: true, is_pfatc: false },
      flight
    );
    expect(url).toBe(panelUrl);
    expect(mocks.hasActiveExternalAcarsClaim).not.toHaveBeenCalled();
  });

  it('redirects claimed PFATC sessions', async () => {
    mocks.hasActiveExternalAcarsClaim.mockResolvedValue(true);
    mocks.fetch.mockResolvedValue(panelResponse(panelUrl));
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', is_pfatc: true },
      flight
    );
    expect(url).toBe(panelUrl);
  });

  it('never redirects non-PFATC sessions via a claim', async () => {
    mocks.hasActiveExternalAcarsClaim.mockResolvedValue(true);
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', is_pfatc: false },
      flight
    );
    expect(url).toBeUndefined();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('does not contact the panel for unclaimed PFATC sessions', async () => {
    mocks.hasActiveExternalAcarsClaim.mockResolvedValue(false);
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', is_pfatc: true },
      flight
    );
    expect(url).toBeUndefined();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([
    'https://evil.example.com/panel',
    'http://pilot.pfcontrol.com/panel',
    'javascript:alert(1)',
  ])('rejects panel URLs outside the allowlist: %s', async (bad) => {
    mocks.fetch.mockResolvedValue(panelResponse(bad));
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', external_session: true },
      flight
    );
    expect(url).toBeUndefined();
  });
});
