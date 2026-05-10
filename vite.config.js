import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import posthogRollup from "@posthog/rollup-plugin";

const posthogSourceMapsEnabled = Boolean(
  process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID,
);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(posthogSourceMapsEnabled
      ? [
          posthogRollup({
            personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
            projectId: process.env.POSTHOG_PROJECT_ID,
            host:
              process.env.POSTHOG_HOST ||
              process.env.VITE_POSTHOG_HOST ||
              "https://us.i.posthog.com",
            sourcemaps: {
              enabled: true,
              releaseName: "pfcontrol-web",
              releaseVersion:
                process.env.RELEASE_VERSION || process.env.npm_package_version || "0.0.0",
              deleteAfterUpload: true,
            },
          }),
        ]
      : []),
  ],
  build: {
    sourcemap: posthogSourceMapsEnabled ? true : "hidden",
  },
  staged: {
    "*.{js,jsx,ts,tsx}": "vp check --fix",
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
});