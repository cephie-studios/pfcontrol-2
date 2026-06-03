import { PostHogProvider } from '@posthog/react';
import type { ReactNode } from 'react';

const posthogOptions = {
  api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  persistence: 'memory' as const,
} as const;

export function PostHogProviderWrapper({ children }: { children: ReactNode }) {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  if (!apiKey) return <>{children}</>;
  return (
    <PostHogProvider apiKey={apiKey} options={posthogOptions}>
      {children}
    </PostHogProvider>
  );
}
