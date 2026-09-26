import { hasActiveExternalAcarsClaim } from './externalAcarsClaims.js';

const EXTERNAL_ACARS_PANEL_URL =
  'https://pilot.pfcontrol.com/api/v1/pilot/acars-panel/';

const ALLOWED_REDIRECT_HOSTS = new Set([
  new URL(EXTERNAL_ACARS_PANEL_URL).hostname,
]);

interface ExternalAcarsPanelResult {
  url: string;
  expiresAt: string | null;
}

function isAllowedRedirectUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ALLOWED_REDIRECT_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export async function fetchExternalAcarsPanelUrl(
  callsign: string,
  acarsToken: string,
  timeoutMs = 5000
): Promise<ExternalAcarsPanelResult | null> {
  const apiKey = process.env.PILOT_ACARS_PANEL_API_KEY;
  if (!apiKey) {
    console.error(
      '[external-acars-panel] PILOT_ACARS_PANEL_API_KEY is not set, skipping'
    );
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(EXTERNAL_ACARS_PANEL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${apiKey}`,
      },
      body: JSON.stringify({ callsign, acars_token: acarsToken }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `[external-acars-panel] non-OK response: ${response.status}`
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
    if (!isAllowedRedirectUrl(data.url)) {
      console.error(
        '[external-acars-panel] response url is not on an allowed host'
      );
      return null;
    }

    return {
      url: data.url,
      expiresAt: typeof data.expires_at === 'string' ? data.expires_at : null,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[external-acars-panel] request failed:', err);
    return null;
  }
}

async function sessionUsesExternalAcarsPanel(session: {
  session_id: string;
  external_session?: boolean | null;
  is_pfatc?: boolean | null;
}): Promise<boolean> {
  if (session.external_session === true) return true;
  if (!session.is_pfatc) return false;
  try {
    return await hasActiveExternalAcarsClaim(session.session_id);
  } catch (err) {
    console.error('[external-acars-panel] claim lookup failed:', err);
    return false;
  }
}

export async function resolveExternalAcarsRedirectUrl(
  session: {
    session_id: string;
    external_session?: boolean | null;
    is_pfatc?: boolean | null;
  } | null,
  flight: { callsign?: string | null; acars_token?: string | null } | null
): Promise<string | undefined> {
  if (!session || !flight?.callsign || !flight.acars_token) return undefined;
  if (!(await sessionUsesExternalAcarsPanel(session))) return undefined;
  const external = await fetchExternalAcarsPanelUrl(
    flight.callsign,
    flight.acars_token
  );
  return external?.url;
}
