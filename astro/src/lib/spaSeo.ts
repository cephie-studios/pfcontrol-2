export const SPA_SITE_URL = 'https://pfcontrol.com';

export const SPA_DEFAULT_TITLE = 'PFControl v2';

export const SPA_META_DESCRIPTION =
  'PFControl is the next-generation flight strip platform for real-time coordination between air traffic controllers. Secure, reliable, and collaborative.';

export const SPA_DEFAULT_KEYWORDS =
  'PFControl, Project Flight, PTFS, Pilot Training Flight Simulator, Roblox aviation, flight strips, air traffic control, ATC, real-time, aviation games, collaborative, sessions, pilots, controllers, Roblox ATC, Project Flight ATC, aviation simulator, flight control, tower control';

export const SPA_OG_TITLE =
  'PFControl v2 - Flight Strips for Project Flight & Roblox Aviation';

export const SPA_OG_DESCRIPTION =
  'The next-generation flight strip platform built for real-time coordination between air traffic controllers in Project Flight, PTFS, and Roblox aviation games with enterprise-level reliability.';

export const SPA_TWITTER_TITLE =
  'PFControl v2 - Flight Strips for Project Flight & Roblox Aviation';

export const SPA_TWITTER_DESCRIPTION =
  'Professional flight strip platform for Project Flight, PTFS, and other Roblox aviation games. Real-time ATC coordination made easy.';

export const SPA_GOOGLE_ADSENSE_ACCOUNT = 'ca-pub-3075420086521736';

export const SPA_WEBSITE_SEARCH_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'PFControl',
  url: SPA_SITE_URL,
  description:
    'The next-generation flight strip platform built for real-time coordination between air traffic controllers.',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SPA_SITE_URL}/user/{search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
} as const;

export const SPA_WEB_APPLICATION_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'PFControl',
  description: SPA_META_DESCRIPTION,
  url: `${SPA_SITE_URL}/`,
  applicationCategory: 'GameApplication',
  operatingSystem: 'Web',
  inLanguage: 'en-US',
  image: `${SPA_SITE_URL}/assets/images/hero.webp`,
  keywords: SPA_DEFAULT_KEYWORDS,
  author: {
    '@type': 'Organization',
    name: 'Cephie Studios',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Cephie Studios',
    url: SPA_SITE_URL,
  },
};