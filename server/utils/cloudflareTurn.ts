/**
 * Mints short-lived Cloudflare Realtime TURN credentials for voice chat clients.
 *
 * The TURN key (CF_TURN_TOKEN + CF_API_TOKEN) is a long-term secret and must
 * never reach the browser — clients call /api/turn/credentials instead and get
 * back a time-boxed username/credential pair scoped to their user id.
 *
 * TURN only carries traffic that cannot traverse NAT directly, so this is a
 * fallback layer on top of the existing STUN servers, not a replacement.
 */
const TURN_KEY_ID = process.env.CF_TURN_TOKEN;
const TURN_API_TOKEN = process.env.CF_API_TOKEN;

/** Credential lifetime — comfortably longer than a realistic voice session. */
const CREDENTIAL_TTL_SEC = 2 * 60 * 60;
/** Re-mint once a cached credential has less than this left, so it never
 *  expires mid-call. */
const REFRESH_MARGIN_MS = 15 * 60 * 1000;

export interface IceServer {
  urls: string[] | string;
  username?: string;
  credential?: string;
}

interface CachedCredential {
  iceServers: IceServer[];
  expiresAt: number;
}

const cache = new Map<string, CachedCredential>();

export function isTurnConfigured(): boolean {
  return Boolean(TURN_KEY_ID && TURN_API_TOKEN);
}

/**
 * Cloudflare returns a single ICE server object; normalize to an array so the
 * client can splice it straight into RTCConfiguration.iceServers.
 */
function normalizeIceServers(payload: unknown): IceServer[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const { iceServers } = payload as { iceServers?: unknown };
  if (!iceServers) return null;

  const list = Array.isArray(iceServers) ? iceServers : [iceServers];
  const valid = list.filter(
    (s): s is IceServer =>
      Boolean(s) && typeof s === 'object' && 'urls' in (s as object)
  );

  return valid.length > 0 ? valid : null;
}

/**
 * Returns ICE servers for the given user, reusing a cached credential while it
 * still has meaningful life left. Returns null when TURN is not configured or
 * Cloudflare is unreachable — callers should degrade to STUN-only rather than
 * failing the call.
 */
export async function getTurnIceServers(
  userId: string
): Promise<IceServer[] | null> {
  if (!isTurnConfigured()) return null;

  const cached = cache.get(userId);
  if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return cached.iceServers;
  }

  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TURN_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: CREDENTIAL_TTL_SEC }),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(
        `[TURN] Cloudflare credential request failed (${response.status}): ${body.slice(0, 300)}`
      );
      // Serve a stale-but-unexpired credential rather than dropping to
      // STUN-only just because one mint failed.
      if (cached && cached.expiresAt > Date.now()) return cached.iceServers;
      return null;
    }

    const iceServers = normalizeIceServers(await response.json());
    if (!iceServers) {
      console.warn('[TURN] Unexpected response shape from Cloudflare');
      if (cached && cached.expiresAt > Date.now()) return cached.iceServers;
      return null;
    }

    cache.set(userId, {
      iceServers,
      expiresAt: Date.now() + CREDENTIAL_TTL_SEC * 1000,
    });

    return iceServers;
  } catch (err) {
    console.warn('[TURN] Cloudflare credential request errored:', err);
    if (cached && cached.expiresAt > Date.now()) return cached.iceServers;
    return null;
  }
}

/** Drops expired entries so the cache does not grow with churned users. */
export function pruneTurnCredentialCache(): void {
  const now = Date.now();
  for (const [userId, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(userId);
  }
}

export function clearTurnCredentialCacheForTests(): void {
  cache.clear();
}
