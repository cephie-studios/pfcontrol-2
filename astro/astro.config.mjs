import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const mode =
  process.env.NODE_ENV === 'production' ? 'production' : 'development';
const rootViteEnv = loadEnv(mode, repoRoot, 'VITE_');
const rootSitemapEnv = loadEnv(mode, repoRoot, [
  'VITE_',
  'POSTGRES_',
  'ADMIN_',
  'SITEMAP_',
]);

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

const STATIC_APP_SITEMAP_URLS = [
  `${SITE}/create`,
  `${SITE}/overview`,
  `${SITE}/login`,
];

async function loadUserProfileSitemapUrls() {
  const fromEnv =
    rootSitemapEnv.SITEMAP_PROFILE_USERNAMES ??
    process.env.SITEMAP_PROFILE_USERNAMES ??
    '';
  if (fromEnv.trim()) {
    const urls = [];
    for (const part of fromEnv.split(/[,\n]/)) {
      const u = part.trim();
      if (u) urls.push(`${SITE}/user/${encodeURIComponent(u)}`);
    }
    if (urls.length) return urls;
  }

  const profileListUrl =
    rootSitemapEnv.SITEMAP_PROFILE_LIST_URL ??
    process.env.SITEMAP_PROFILE_LIST_URL ??
    '';
  if (profileListUrl.trim()) {
    try {
      const res = await fetch(profileListUrl.trim());
      if (res.ok) {
        const data = await res.json();
        const names = Array.isArray(data.usernames) ? data.usernames : [];
        if (names.length) {
          return names.map(
            (u) => `${SITE}/user/${encodeURIComponent(String(u))}`
          );
        }
      }
    } catch (e) {
      console.warn(
        '[@astrojs/sitemap] SITEMAP_PROFILE_LIST_URL fetch failed:',
        e instanceof Error ? e.message : e
      );
    }
  }

  const dbUrl =
    rootSitemapEnv.POSTGRES_DB_URL ?? process.env.POSTGRES_DB_URL ?? '';
  if (!dbUrl) {
    return [];
  }

  const adminIds = (rootSitemapEnv.ADMIN_IDS ?? process.env.ADMIN_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const sitemapModulePath = fileURLToPath(
    new URL('../server/dist/db/sitemapProfiles.js', import.meta.url)
  );
  if (!existsSync(sitemapModulePath)) {
    console.warn(
      '[@astrojs/sitemap] No /user/* URLs: run `npm run build:server` before `astro build`, or set SITEMAP_PROFILE_LIST_URL / SITEMAP_PROFILE_USERNAMES.'
    );
    return [];
  }

  try {
    const mod = await import(pathToFileURL(sitemapModulePath).href);
    const usernames = await mod.querySitemapProfileUsernames(dbUrl, adminIds);
    return usernames.map(
      (u) => `${SITE}/user/${encodeURIComponent(String(u))}`
    );
  } catch (e) {
    const code =
      typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined;
    if (
      code !== 'ECONNREFUSED' &&
      code !== 'ENOTFOUND' &&
      code !== 'ETIMEDOUT'
    ) {
      console.warn(
        '[@astrojs/sitemap] Skipping /user/* URLs:',
        e instanceof Error ? e.message : e
      );
    }
    return [];
  }
}

async function loadFeaturedFlightSitemapUrls() {
  const fromEnv =
    rootSitemapEnv.SITEMAP_FLIGHT_IDS ?? process.env.SITEMAP_FLIGHT_IDS ?? '';
  if (fromEnv.trim()) {
    const urls = [];
    for (const part of fromEnv.split(/[,\n]/)) {
      const id = part.trim();
      if (id) urls.push(`${SITE}/flight/${encodeURIComponent(id)}`);
    }
    if (urls.length) return urls;
  }

  const flightListUrl =
    rootSitemapEnv.SITEMAP_FLIGHT_LIST_URL ??
    process.env.SITEMAP_FLIGHT_LIST_URL ??
    '';
  if (flightListUrl.trim()) {
    try {
      const res = await fetch(flightListUrl.trim());
      if (res.ok) {
        const data = await res.json();
        const ids = Array.isArray(data.ids) ? data.ids : [];
        if (ids.length) {
          return ids.map(
            (id) => `${SITE}/flight/${encodeURIComponent(String(id))}`
          );
        }
      }
    } catch (e) {
      console.warn(
        '[@astrojs/sitemap] SITEMAP_FLIGHT_LIST_URL fetch failed:',
        e instanceof Error ? e.message : e
      );
    }
  }

  const dbUrl =
    rootSitemapEnv.POSTGRES_DB_URL ?? process.env.POSTGRES_DB_URL ?? '';
  if (!dbUrl) {
    return [];
  }

  const sitemapModulePath = fileURLToPath(
    new URL('../server/dist/db/sitemapFlights.js', import.meta.url)
  );
  if (!existsSync(sitemapModulePath)) {
    console.warn(
      '[@astrojs/sitemap] No /flight/* URLs: run `npm run build:server` before `astro build`, or set SITEMAP_FLIGHT_LIST_URL / SITEMAP_FLIGHT_IDS.'
    );
    return [];
  }

  try {
    const mod = await import(pathToFileURL(sitemapModulePath).href);
    const ids = await mod.querySitemapFeaturedFlightIds(dbUrl);
    return ids.map((id) => `${SITE}/flight/${encodeURIComponent(String(id))}`);
  } catch (e) {
    const code =
      typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined;
    if (
      code !== 'ECONNREFUSED' &&
      code !== 'ENOTFOUND' &&
      code !== 'ETIMEDOUT'
    ) {
      console.warn(
        '[@astrojs/sitemap] Skipping /flight/* URLs:',
        e instanceof Error ? e.message : e
      );
    }
    return [];
  }
}

const profileSitemapUrls = await loadUserProfileSitemapUrls();
const allowedUserProfileUrls = new Set(profileSitemapUrls);

const featuredFlightSitemapUrls = await loadFeaturedFlightSitemapUrls();
const allowedFlightUrls = new Set(featuredFlightSitemapUrls);

const customPages = [
  ...STATIC_APP_SITEMAP_URLS,
  ...profileSitemapUrls,
  ...featuredFlightSitemapUrls,
];

export default defineConfig({
  site: SITE,
  output: 'server',
  adapter: node({ mode: 'middleware' }),
  integrations: [
    react(),
    sitemap({
      customPages,
      filter: (page) => {
        try {
          const pathname = new URL(page).pathname.replace(/\/$/, '') || '/';
          const base = `${SITE}${pathname}`;
          const withSlash = `${base}/`;
          if (pathname.startsWith('/user/')) {
            return (
              allowedUserProfileUrls.has(base) ||
              allowedUserProfileUrls.has(withSlash) ||
              allowedUserProfileUrls.has(page)
            );
          }
          if (pathname.startsWith('/flight/')) {
            return (
              allowedFlightUrls.has(base) ||
              allowedFlightUrls.has(withSlash) ||
              allowedFlightUrls.has(page)
            );
          }
          return true;
        } catch {
          return true;
        }
      },
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
