import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const mode =
  process.env.NODE_ENV === 'production' ? 'production' : 'development';
const rootViteEnv = loadEnv(mode, repoRoot, 'VITE_');

const posthogKey =
  rootViteEnv.VITE_POSTHOG_KEY ?? process.env.VITE_POSTHOG_KEY ?? '';
const posthogHost =
  rootViteEnv.VITE_POSTHOG_HOST ??
  process.env.VITE_POSTHOG_HOST ??
  'https://us.i.posthog.com';
const astroClientApiBase =
  mode === 'production'
    ? ''
    : (rootViteEnv.VITE_SERVER_URL ??
      process.env.VITE_SERVER_URL ??
      'http://localhost:9901');

const SITE = 'https://pfcontrol.com';

// /user/* and /flight/* are covered by their own live, DB-backed sitemaps
// (server/routes/sitemapXml.ts, served at /sitemap-users.xml and
// /sitemap-flights.xml and declared in robots.txt) rather than this
// build-time one, since that data changes far more often than static pages.
const customPages = [`${SITE}/create`, `${SITE}/overview`, `${SITE}/login`];

export default defineConfig({
  site: SITE,
  output: 'server',
  adapter: node({ mode: 'middleware' }),
  integrations: [
    react(),
    sitemap({
      customPages,
    }),
  ],
  build: {
    inlineStylesheets: 'always',
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@app': fileURLToPath(new URL('../src', import.meta.url)),
      },
    },
    ssr: {
      noExternal: ['react-router', '@posthog/react', 'posthog-js'],
    },
    define: {
      'import.meta.env.VITE_POSTHOG_KEY': JSON.stringify(posthogKey),
      'import.meta.env.VITE_POSTHOG_HOST': JSON.stringify(posthogHost),
      'import.meta.env.VITE_SERVER_URL': JSON.stringify(astroClientApiBase),
    },
  },
});
