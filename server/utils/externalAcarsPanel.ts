const EXTERNAL_ACARS_PANEL_URL =
  'https://pilot.pfcontrol.com/api/v1/pilot/acars-panel/';

interface ExternalAcarsPanelResult {
  url: string;
  expiresAt: string | null;
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
        Authorization: `Bearer ${apiKey}`,
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
