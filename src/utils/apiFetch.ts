/**
 * Drop-in replacement for fetch that fires 'auth:forbidden' when the server
 * explicitly blocks the authenticated user (ban or VPN gate).
 * AuthProvider listens for this event and calls refreshUser(), causing
 * App.tsx to re-evaluate user.isBanned / user.isVpnBlocked and show the
 * appropriate AccessDenied page.
 *
 * Generic 403s (e.g. "you don't own this session") are intentionally ignored
 * so they don't trigger a spurious user refresh.
 */
import { posthog } from './posthog';

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const sessionId = posthog.get_session_id?.();
  if (sessionId) headers.set('x-posthog-session-id', sessionId);
  try {
    const distinctId = posthog.get_distinct_id?.();
    if (distinctId) headers.set('x-posthog-distinct-id', distinctId);
  } catch {
    /* ignore */
  }

  let res: Response;
  try {
    res = await fetch(input, { ...init, headers });
  } catch (error) {
    posthog.captureException?.(error, {
      source: 'apiFetch',
      url: typeof input === 'string' ? input : String(input),
    });
    throw error;
  }

  if (!res.ok && res.status >= 500) {
    const text = await res
      .clone()
      .text()
      .catch(() => '');
    posthog.captureException?.(
      new Error(`HTTP ${res.status} from ${String(input)}`),
      {
        source: 'apiFetch',
        status: res.status,
        body_preview: text.slice(0, 500),
      }
    );
  }

  if (res.status === 403) {
    // Clone so the caller can still consume the original response body.
    res
      .clone()
      .json()
      .then((data: { error?: string }) => {
        if (
          data?.error === 'Account is banned' ||
          data?.error === 'VPN access blocked'
        ) {
          window.dispatchEvent(new CustomEvent('auth:forbidden'));
        }
      })
      .catch(() => {});
  }

  return res;
}
