import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

const mocks = vi.hoisted(() => ({
  hasActiveExternalAcarsClaim: vi.fn(),
  getExternalAcarsClaim: vi.fn(),
  getDefaultExternalAcarsProvider: vi.fn(),
  getExternalAcarsProvider: vi.fn(),
  getSiteSettings: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('../../../server/db/siteSettings.js', () => ({
  getSiteSettings: mocks.getSiteSettings,
}));

vi.mock('../../../server/utils/externalAcarsClaims.js', () => ({
  hasActiveExternalAcarsClaim: mocks.hasActiveExternalAcarsClaim,
  getExternalAcarsClaim: mocks.getExternalAcarsClaim,
}));

vi.mock('../../../server/db/externalAcarsProviders.js', () => ({
  getDefaultExternalAcarsProvider: mocks.getDefaultExternalAcarsProvider,
  getExternalAcarsProvider: mocks.getExternalAcarsProvider,
}));

import { readExternalAcarsAccess } from '../../../server/utils/externalAcarsAccess.js';
import {
  providerForExternalAcarsSession,
  resetLegacyExternalAcarsRedirectCache,
  resolveExternalAcarsRedirectUrl,
} from '../../../server/utils/externalAcarsPanel.js';

const flight = { id: 'Fl12Gh34', callsign: 'BAW123', acars_token: 'tok' };
const panelUrl =
  'https://pilot.pfcontrol.com/panel/abc?callsign=BAW123&token=handed-token';
const provider = {
  id: 'external-acars',
  displayName: 'External ACARS',
  apiBaseUrl: 'https://provider.example',
  tokenHeader: 'X-Flight-Token',
  handoffUrl: 'https://provider.example/api/acars-panel/',
  handoffApiKey: 'secret',
  enabled: true,
  isDefault: true,
};

function panelResponse(url: string, extra: object = {}) {
  return { ok: true, json: async () => ({ url, ...extra }) };
}

function expectLocalPanelUrl(url: string | undefined) {
  expect(url).toBeDefined();
  const parsed = new URL(url!);
  expect(parsed.pathname).toBe('/acars/Ab12Cd34/Fl12Gh34');
  expect(parsed.searchParams.get('external_acars')).toBe('external-acars');
  expect(parsed.searchParams.get('callsign')).toBe('BAW123');
  expect(parsed.searchParams.get('token')).not.toContain('handed-token');
  return readExternalAcarsAccess(parsed.searchParams.get('token')!);
}

describe('resolveExternalAcarsRedirectUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.fetch.mockReset();
    mocks.hasActiveExternalAcarsClaim.mockReset();
    mocks.getExternalAcarsClaim.mockReset();
    mocks.getDefaultExternalAcarsProvider.mockResolvedValue(provider);
    mocks.getExternalAcarsProvider.mockResolvedValue(provider);
    mocks.getSiteSettings.mockResolvedValue({
      feedbackBannerEnabled: false,
      externalAcarsLegacyRedirect: false,
    });
    resetLegacyExternalAcarsRedirectCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens PFControl ACARS for external sessions without checking claims', async () => {
    mocks.fetch.mockResolvedValue(panelResponse(panelUrl));
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', external_session: true, is_pfatc: false },
      flight
    );
    const access = expectLocalPanelUrl(url);
    expect(access).toMatchObject({
      sessionId: 'Ab12Cd34',
      flightId: 'Fl12Gh34',
      callsign: 'BAW123',
      providerId: 'external-acars',
      providerToken: 'handed-token',
      acarsToken: 'tok',
    });
    expect(mocks.hasActiveExternalAcarsClaim).not.toHaveBeenCalled();
  });

  it('sends the flight token to the provider handoff endpoint', async () => {
    mocks.fetch.mockResolvedValue(panelResponse(panelUrl));
    await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', external_session: true },
      flight
    );
    const [target, init] = mocks.fetch.mock.calls[0];
    expect(target).toBe(provider.handoffUrl);
    expect(init.headers.Authorization).toBe('ApiKey secret');
    expect(JSON.parse(init.body)).toEqual({
      callsign: 'BAW123',
      acars_token: 'tok',
    });
  });

  it('opens PFControl ACARS for claimed PFATC sessions', async () => {
    mocks.hasActiveExternalAcarsClaim.mockResolvedValue(true);
    mocks.getExternalAcarsClaim.mockResolvedValue({
      providerId: 'external-acars',
    });
    mocks.fetch.mockResolvedValue(panelResponse(panelUrl));
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', is_pfatc: true },
      flight
    );
    expect(expectLocalPanelUrl(url)?.providerId).toBe('external-acars');
    expect(mocks.getExternalAcarsProvider).toHaveBeenCalledWith(
      'external-acars'
    );
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

  it('falls back to native ACARS when no provider is configured', async () => {
    mocks.getDefaultExternalAcarsProvider.mockResolvedValue(null);
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', external_session: true },
      flight
    );
    expect(url).toBeUndefined();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(['http://pilot.pfcontrol.com/panel', 'javascript:alert(1)'])(
    'rejects non-HTTPS panel URLs: %s',
    async (bad) => {
      mocks.fetch.mockResolvedValue(panelResponse(bad));
      const url = await resolveExternalAcarsRedirectUrl(
        { session_id: 'Ab12Cd34', external_session: true },
        flight
      );
      expect(url).toBeUndefined();
    }
  );

  it.each([
    ['a different callsign', 'https://p.example/panel?callsign=DLH1&token=t'],
    ['no token', 'https://p.example/panel?callsign=BAW123'],
    ['no callsign', 'https://p.example/panel?token=t'],
  ])('rejects a handoff URL with %s', async (_name, bad) => {
    mocks.fetch.mockResolvedValue(panelResponse(bad));
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', external_session: true },
      flight
    );
    expect(url).toBeUndefined();
  });

  it('accepts the callsign in the ICAO form the provider normalises to', async () => {
    mocks.fetch.mockResolvedValue(
      panelResponse('https://p.example/acars/?callsign=BAW123&token=t')
    );
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', external_session: true },
      { ...flight, callsign: 'BAW-123' }
    );
    expect(expectLocalPanelUrl(url)?.callsign).toBe('BAW123');
  });

  it('rejects a token longer than the provider accepts', async () => {
    mocks.fetch.mockResolvedValue(
      panelResponse(
        `https://p.example/acars/?callsign=BAW123&token=${'t'.repeat(129)}`
      )
    );
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', external_session: true },
      flight
    );
    expect(url).toBeUndefined();
  });

  it('rejects a handoff that has already expired', async () => {
    mocks.fetch.mockResolvedValue(
      panelResponse(panelUrl, { expires_at: '2000-01-01T00:00:00Z' })
    );
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', external_session: true },
      flight
    );
    expect(url).toBeUndefined();
  });

  it('returns nothing when the provider responds with an error', async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 500 });
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', external_session: true },
      flight
    );
    expect(url).toBeUndefined();
  });

  it('does not throw when the claim lookup fails', async () => {
    mocks.hasActiveExternalAcarsClaim.mockRejectedValue(
      new Error('redis down')
    );
    const url = await resolveExternalAcarsRedirectUrl(
      { session_id: 'Ab12Cd34', is_pfatc: true },
      flight
    );
    expect(url).toBeUndefined();
  });

  describe('legacy v2 redirect', () => {
    const legacyUrl = 'https://pilot.pfcontrol.com/panel/abc?t=1';

    beforeEach(() => {
      mocks.getSiteSettings.mockResolvedValue({
        feedbackBannerEnabled: false,
        externalAcarsLegacyRedirect: true,
      });
      vi.stubEnv('PILOT_ACARS_PANEL_API_KEY', 'legacy-key');
      mocks.getDefaultExternalAcarsProvider.mockClear();
    });

    it('redirects claimed PFATC sessions straight to pilot.pfcontrol.com', async () => {
      mocks.hasActiveExternalAcarsClaim.mockResolvedValue(true);
      mocks.fetch.mockResolvedValue(panelResponse(legacyUrl));
      const url = await resolveExternalAcarsRedirectUrl(
        { session_id: 'Ab12Cd34', is_pfatc: true },
        flight
      );
      expect(url).toBe(legacyUrl);
      const [target, init] = mocks.fetch.mock.calls[0];
      expect(target).toBe(
        'https://pilot.pfcontrol.com/api/v1/pilot/acars-panel/'
      );
      expect(init.headers.Authorization).toBe('ApiKey legacy-key');
      expect(mocks.getDefaultExternalAcarsProvider).not.toHaveBeenCalled();
    });

    it('redirects external sessions without checking claims', async () => {
      mocks.fetch.mockResolvedValue(panelResponse(legacyUrl));
      const url = await resolveExternalAcarsRedirectUrl(
        { session_id: 'Ab12Cd34', external_session: true },
        flight
      );
      expect(url).toBe(legacyUrl);
      expect(mocks.hasActiveExternalAcarsClaim).not.toHaveBeenCalled();
    });

    it('ignores unclaimed PFATC sessions', async () => {
      mocks.hasActiveExternalAcarsClaim.mockResolvedValue(false);
      const url = await resolveExternalAcarsRedirectUrl(
        { session_id: 'Ab12Cd34', is_pfatc: true },
        flight
      );
      expect(url).toBeUndefined();
      expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it('rejects a panel url on another host', async () => {
      mocks.fetch.mockResolvedValue(
        panelResponse('https://evil.example/panel')
      );
      const url = await resolveExternalAcarsRedirectUrl(
        { session_id: 'Ab12Cd34', external_session: true },
        flight
      );
      expect(url).toBeUndefined();
    });

    it('skips the redirect when the api key is missing', async () => {
      vi.stubEnv('PILOT_ACARS_PANEL_API_KEY', '');
      const url = await resolveExternalAcarsRedirectUrl(
        { session_id: 'Ab12Cd34', external_session: true },
        flight
      );
      expect(url).toBeUndefined();
      expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it('hides v3 providers so the ACARS page falls back to the redirect', async () => {
      expect(
        await providerForExternalAcarsSession({
          session_id: 'Ab12Cd34',
          external_session: true,
        })
      ).toBeNull();
    });
  });
});
