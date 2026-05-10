import { PostHog } from "posthog-node";
import type { Request } from "express";

const noop = {
  capture: () => {},
  identify: () => {},
  captureException: () => {},
  captureExceptionImmediate: async () => {},
  addPendingPromise: () => {},
  shutdown: async () => {},
} as unknown as PostHog;

const client: PostHog = process.env.POSTHOG_API_KEY
  ? new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      enableExceptionAutocapture: true,
    })
  : noop;

export const posthogServerEnabled = Boolean(process.env.POSTHOG_API_KEY);

if (process.env.POSTHOG_API_KEY) {
  process.on("SIGINT", async () => {
    await client.shutdown();
  });
  process.on("SIGTERM", async () => {
    await client.shutdown();
  });
}

interface CaptureParams {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export function capture(req: Request, params: CaptureParams): void {
  const sessionId = req.headers["x-posthog-session-id"];
  const currentUrl = req.headers.referer || req.headers.origin;
  client.capture({
    ...params,
    properties: {
      ...params.properties,
      ...(sessionId ? { $session_id: String(sessionId) } : {}),
      ...(currentUrl ? { $current_url: String(currentUrl) } : {}),
    },
  });
}

/**
 * Report a caught exception with request/session context for Error Tracking.
 */
export function captureRequestException(
  req: Request,
  error: unknown,
  additional?: Record<string, unknown>,
): void {
  if (!posthogServerEnabled) return;
  const distinctId =
    req.user?.userId ??
    (typeof req.headers["x-posthog-distinct-id"] === "string"
      ? req.headers["x-posthog-distinct-id"]
      : undefined) ??
    "server-anonymous";
  const sessionId = req.headers["x-posthog-session-id"];
  const currentUrl = req.headers.referer || req.headers.origin || req.originalUrl;
  client.captureException(error, distinctId, {
    ...additional,
    ...(sessionId ? { $session_id: String(sessionId) } : {}),
    ...(currentUrl ? { $current_url: String(currentUrl) } : {}),
    $request_method: req.method,
    $request_path: req.path,
  });
}

export default client;