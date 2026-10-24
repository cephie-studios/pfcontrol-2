import {
  getExternalAcarsClaim,
  hasActiveExternalAcarsClaim,
} from './externalAcarsClaims.js';
import {
  getDefaultExternalAcarsProvider,
  getExternalAcarsProvider,
  type ExternalAcarsProvider,
} from '../db/externalAcarsProviders.js';
import { createExternalAcarsAccess } from './externalAcarsAccess.js';

const MAX_PROVIDER_TOKEN_LENGTH = 128;

const sameCallsign = (a: string, b: string) =>
  a.toUpperCase().replace(/[^A-Z0-9]/g, '') ===
  b.toUpperCase().replace(/[^A-Z0-9]/g, '');

interface ExternalAcarsPanelResult {
  callsign: string;
  token: string;
  expiresAt: string | null;
}

interface SessionRef {
  session_id: string;
  external_session?: boolean | null;
  is_pfatc?: boolean | null;
}

export async function fetchExternalAcarsPanelAccess(
  callsign: string,
  acarsToken: string,
  provider: ExternalAcarsProvider,
  timeoutMs = 5000
): Promise<ExternalAcarsPanelResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(provider.handoffUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.handoffApiKey
          ? { Authorization: `ApiKey ${provider.handoffApiKey}` }
          : {}),
      },
      body: JSON.stringify({ callsign, acars_token: acarsToken }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as {
        type?: unknown;
      } | null;
      console.error(
        `[external-acars-panel] non-OK response: ${response.status} ${typeof error?.type === 'string' ? error.type : ''}`.trim(),
        response.headers?.get('X-Request-ID') ?? ''
      );
      return null;
    }

    const data = (await response.json()) as {
      url?: unknown;
      expires_at?: unknown;
    };
    if (typeof data?.url !== 'string' || !data.url) {
      console.error('[external-acars-panel] response missing url field');
      return null;
    }

    const panelUrl = new URL(data.url);
    if (panelUrl.protocol !== 'https:') {
      console.error('[external-acars-panel] response URL is not HTTPS');
      return null;
    }

    const handedCallsign = panelUrl.searchParams.get('callsign')?.trim();
    const token = panelUrl.searchParams.get('token')?.trim();
    if (
      !handedCallsign ||
      !sameCallsign(handedCallsign, callsign) ||
      !token ||
      token.length > MAX_PROVIDER_TOKEN_LENGTH
    ) {
      console.error(
        '[external-acars-panel] response URL is missing callsign or token'
      );
      return null;
    }

    return {
      callsign: handedCallsign.toUpperCase(),
      token,
      expiresAt: typeof data.expires_at === 'string' ? data.expires_at : null,
    };
  } catch (err) {
    console.error('[external-acars-panel] request failed:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function providerForExternalAcarsSession(
  session: SessionRef
): Promise<ExternalAcarsProvider | null> {
  if (session.external_session === true) {
    return getDefaultExternalAcarsProvider();
  }
  if (!session.is_pfatc) return null;
  if (!(await hasActiveExternalAcarsClaim(session.session_id))) return null;

  const claim = await getExternalAcarsClaim(session.session_id);
  return claim?.providerId
    ? getExternalAcarsProvider(claim.providerId)
    : getDefaultExternalAcarsProvider();
}

export async function resolveExternalAcarsRedirectUrl(
  session: SessionRef | null,
  flight: {
    id?: string | number | null;
    callsign?: string | null;
    acars_token?: string | null;
  } | null
): Promise<string | undefined> {
  if (!session || !flight?.id || !flight.callsign || !flight.acars_token) {
    return undefined;
  }

  try {
    const provider = await providerForExternalAcarsSession(session);
    if (!provider) return undefined;

    const external = await fetchExternalAcarsPanelAccess(
      flight.callsign,
      flight.acars_token,
      provider
    );
    if (!external) return undefined;

    const flightId = String(flight.id);
    const url = new URL(
      `/acars/${encodeURIComponent(session.session_id)}/${encodeURIComponent(flightId)}`,
      process.env.FRONTEND_URL ?? 'https://pfcontrol.com'
    );
    url.searchParams.set('external_acars', provider.id);
    url.searchParams.set('callsign', external.callsign);
    url.searchParams.set(
      'token',
      createExternalAcarsAccess(
        {
          sessionId: session.session_id,
          flightId,
          callsign: external.callsign,
          providerId: provider.id,
          providerToken: external.token,
          acarsToken: flight.acars_token,
        },
        external.expiresAt
      )
    );
    return url.toString();
  } catch (err) {
    console.error('[external-acars-panel] resolve failed:', err);
    return undefined;
  }
}
