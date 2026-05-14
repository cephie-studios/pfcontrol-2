import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import { fileURLToPath } from 'url';
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
const astroClientApiBase = '';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'middleware' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@app': fileURLToPath(new URL('../src', import.meta.url)),
      },
    },
    define: {
      'import.meta.env.VITE_POSTHOG_KEY': JSON.stringify(posthogKey),
      'import.meta.env.VITE_POSTHOG_HOST': JSON.stringify(posthogHost),
      'import.meta.env.VITE_SERVER_URL': JSON.stringify(astroClientApiBase),
    },
  },
});
