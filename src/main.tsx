import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { PostHogErrorBoundary, PostHogProvider } from "@posthog/react";
import { AuthProvider } from "./hooks/auth/AuthProvider.tsx";
import { DataProvider } from "./hooks/data/DataProvider.tsx";
import { SettingsProvider } from "./hooks/settings/SettingsProvider.tsx";
import PostHogErrorFallback from "./components/PostHogErrorFallback.tsx";

const posthogOptions = {
  api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  persistence: "memory" as const,
  errorTracking: {
    autocaptureExceptions: true,
  },
} as const;

createRoot(document.getElementById("root")!).render(
  <PostHogProvider
    apiKey={import.meta.env.VITE_POSTHOG_KEY}
    options={posthogOptions}
  >
    <PostHogErrorBoundary fallback={PostHogErrorFallback}>
      <AuthProvider>
        <DataProvider>
          <SettingsProvider>
            <App />
          </SettingsProvider>
        </DataProvider>
      </AuthProvider>
    </PostHogErrorBoundary>
  </PostHogProvider>
);
