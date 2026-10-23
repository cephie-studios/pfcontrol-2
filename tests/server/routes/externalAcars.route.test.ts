import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRequest } from '../helpers/appRequest.js';

const mocks = vi.hoisted(() => ({
  validateAcarsAccess: vi.fn(),
  getFlightById: vi.fn(),
  getSessionById: vi.fn(),
  providerForExternalAcarsSession: vi.fn(),
  resolveExternalAcarsRedirectUrl: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('../../../server/db/flights.js', () => ({
  validateAcarsAccess: mocks.validateAcarsAccess,
  getFlightById: mocks.getFlightById,
}));

vi.mock('../../../server/db/sessions.js', () => ({
  getSessionById: mocks.getSessionById,
}));

vi.mock('../../../server/utils/externalAcarsPanel.js', () => ({
  providerForExternalAcarsSession: mocks.providerForExternalAcarsSession,
  resolveExternalAcarsRedirectUrl: mocks.resolveExternalAcarsRedirectUrl,
}));

import { createExternalAcarsAccess } from '../../../server/utils/externalAcarsAccess.js';
import externalAcarsRouter from '../../../server/routes/externalAcars.js';

const provider = {
  id: 'external-acars',
  apiBaseUrl: 'https://provider.example',
  tokenHeader: 'X-Flight-Token',
};

function accessToken(overrides: Partial<{ callsign: string }> = {}) {
  return createExternalAcarsAccess(
    {
      sessionId: 'Ab12Cd34',
      flightId: 'Fl12Gh34',
      callsign: 'BAW123',
      providerId: 'external-acars',
      providerToken: 'provider-token',
      acarsToken: 'tok',
      ...overrides,
    },
    null
  );
}

function upstream(status: number, body: string, headers: HeadersInit = {}) {
  return new Response(body, { status, headers });
}

describe('external ACARS proxy', () => {
  const app = express();
  app.use(express.json());
  app.use('/', externalAcarsRouter);

  const proxied = (
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    token: string | null = accessToken()
  ) =>
    appRequest(
      app,
      method,
      `/external-acars/flights/BAW123${path}`,
      body,
      token ? { 'X-External-ACARS-Token': token } : {}
    );

  beforeEach(() => {
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.fetch.mockReset();
    mocks.validateAcarsAccess.mockReset().mockResolvedValue({ valid: true });
    mocks.getSessionById.mockReset().mockResolvedValue({
      session_id: 'Ab12Cd34',
    });
    mocks.providerForExternalAcarsSession
      .mockReset()
      .mockResolvedValue(provider);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejects a request without an access token', async () => {
    const res = await proxied('GET', '', undefined, null);
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'access_expired' });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('rejects a token minted for another callsign', async () => {
    const res = await proxied(
      'GET',
      '',
      undefined,
      accessToken({ callsign: 'DLH1' })
    );
    expect(res.status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('rejects a path the provider API does not offer', async () => {
    const res = await proxied('GET', '/map/');
    expect(res.status).toBe(404);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('rejects a method the path does not allow', async () => {
    const res = await proxied('POST', '', {});
    expect(res.status).toBe(405);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('refuses once the flight is no longer valid', async () => {
    mocks.validateAcarsAccess.mockResolvedValue({ valid: false });
    const res = await proxied('GET', '');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'flight_unavailable' });
  });

  it('points the client back to native ACARS once the claim is released', async () => {
    mocks.providerForExternalAcarsSession.mockResolvedValue(null);
    const res = await proxied('GET', '');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      code: 'acars_mode_changed',
      redirectUrl: '/acars/Ab12Cd34/Fl12Gh34?acars_token=tok',
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('forwards the status read with the provider token and adds the claim link', async () => {
    mocks.fetch.mockResolvedValue(
      upstream(200, JSON.stringify({ flight: { callsign: 'BAW123' } }))
    );
    const res = await proxied('GET', '');

    const [target, init] = mocks.fetch.mock.calls[0];
    expect(target).toBe(
      'https://provider.example/api/v1/pilot/flights/BAW123/'
    );
    expect(init.method).toBe('GET');
    expect(init.headers['X-Flight-Token']).toBe('provider-token');
    expect(init.body).toBeUndefined();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      flight: { callsign: 'BAW123' },
      pfcontrol: {
        claimUrl:
          '/my-flights?claimSessionId=Ab12Cd34&claimFlightId=Fl12Gh34&claimToken=tok',
      },
    });
  });

  it('forwards commands with their body', async () => {
    mocks.fetch.mockResolvedValue(
      upstream(200, JSON.stringify({ delivered: true }))
    );
    const res = await proxied('POST', '/acars/respond/', {
      element: 'DM0',
      mrn: 3,
    });

    const [target, init] = mocks.fetch.mock.calls[0];
    expect(target).toBe(
      'https://provider.example/api/v1/pilot/flights/BAW123/acars/respond/'
    );
    expect(JSON.parse(init.body)).toEqual({ element: 'DM0', mrn: 3 });
    expect(res.body).toEqual({ delivered: true });
  });

  it('passes a provider error through with its request id', async () => {
    mocks.fetch.mockResolvedValue(
      upstream(409, JSON.stringify({ details: 'Wrong flight' }), {
        'X-Request-ID': 'req-1',
      })
    );
    const res = await proxied('POST', '/transponder/', { squawk: '1234' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ details: 'Wrong flight', requestId: 'req-1' });
  });

  it('never relays a non-JSON provider response', async () => {
    mocks.fetch.mockResolvedValue(upstream(200, '<html><script>x</script>'));
    const res = await proxied('GET', '');
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ code: 'provider_invalid_response' });
  });

  it('reports an unreachable provider', async () => {
    mocks.fetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await proxied('POST', '/acars/', { text: 'HELLO' });
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ code: 'provider_unreachable' });
  });
});

describe('POST /resolve/:sessionId/:flightId', () => {
  const app = express();
  app.use(express.json());
  app.use('/', externalAcarsRouter);

  beforeEach(() => {
    mocks.validateAcarsAccess.mockReset().mockResolvedValue({ valid: true });
    mocks.getSessionById.mockReset().mockResolvedValue({
      session_id: 'Ab12Cd34',
    });
    mocks.getFlightById.mockReset().mockResolvedValue({
      id: 'Fl12Gh34',
      callsign: 'BAW123',
    });
    mocks.providerForExternalAcarsSession.mockReset().mockResolvedValue(null);
    mocks.resolveExternalAcarsRedirectUrl.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const resolve = (acarsToken?: string) =>
    appRequest(app, 'POST', '/resolve/Ab12Cd34/Fl12Gh34', { acarsToken });

  it('rejects an invalid ACARS token', async () => {
    mocks.validateAcarsAccess.mockResolvedValue({ valid: false });
    expect((await resolve('bad')).status).toBe(403);
  });

  it('keeps unclaimed sessions on native ACARS', async () => {
    const res = await resolve('tok');
    expect(res.body).toEqual({ mode: 'default' });
  });

  it('falls back to native ACARS when the provider lookup fails', async () => {
    mocks.providerForExternalAcarsSession.mockRejectedValue(new Error('down'));
    const res = await resolve('tok');
    expect(res.body).toEqual({ mode: 'default' });
  });

  it('hands claimed sessions over to the external page', async () => {
    mocks.providerForExternalAcarsSession.mockResolvedValue(provider);
    mocks.resolveExternalAcarsRedirectUrl.mockResolvedValue(
      'https://pfcontrol.com/acars/Ab12Cd34/Fl12Gh34?external_acars=x'
    );
    const res = await resolve('tok');
    expect(res.body).toEqual({
      mode: 'external',
      redirectUrl:
        'https://pfcontrol.com/acars/Ab12Cd34/Fl12Gh34?external_acars=x',
    });
  });

  it('reports a failed handoff so the client can retry', async () => {
    mocks.providerForExternalAcarsSession.mockResolvedValue(provider);
    mocks.resolveExternalAcarsRedirectUrl.mockResolvedValue(undefined);
    expect((await resolve('tok')).status).toBe(502);
  });
});
