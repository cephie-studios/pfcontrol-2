import { PostHog } from 'posthog-node';

const noop = { capture: () => {}, shutdown: async () => {} } as unknown as PostHog;

const client: PostHog = process.env.POSTHOG_API_KEY
  ? new PostHog(process.env.POSTHOG_API_KEY, { host: process.env.POSTHOG_HOST })
  : noop;

if (process.env.POSTHOG_API_KEY) {
  process.on('SIGINT', async () => { await client.shutdown(); });
  process.on('SIGTERM', async () => { await client.shutdown(); });
}

export default client;
