import { PostHog } from 'posthog-node';
import type { Request } from 'express';

const noop = { capture: () => {}, shutdown: async () => {} } as unknown as PostHog;

const client: PostHog = process.env.POSTHOG_API_KEY
  ? new PostHog(process.env.POSTHOG_API_KEY, { host: process.env.POSTHOG_HOST })
  : noop;

if (process.env.POSTHOG_API_KEY) {
  process.on('SIGINT', async () => { await client.shutdown(); });
  process.on('SIGTERM', async () => { await client.shutdown(); });
}

interface CaptureParams {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export function capture(req: Request, params: CaptureParams): void {
  const sessionId = req.headers['x-posthog-session-id'];
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

export default client;
