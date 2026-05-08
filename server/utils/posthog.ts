import { PostHog } from 'posthog-node';

const client = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST,
});

process.on('SIGINT', async () => {
  await client.shutdown();
});

process.on('SIGTERM', async () => {
  await client.shutdown();
});

export default client;
