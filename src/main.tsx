import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { PostHogProvider } from '@posthog/react';
import { AuthProvider } from './hooks/auth/AuthProvider.tsx';
import { DataProvider } from './hooks/data/DataProvider.tsx';
import { SettingsProvider } from './hooks/settings/SettingsProvider.tsx';

const posthogOptions = {
  api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  defaults: '2026-01-30',
  persistence: 'memory' as const,
} as const;

createRoot(document.getElementById('root')!).render(
  <PostHogProvider
    apiKey={import.meta.env.VITE_POSTHOG_KEY}
    options={posthogOptions}
  >
    <AuthProvider>
      <DataProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </DataProvider>
    </AuthProvider>
  </PostHogProvider>
);
