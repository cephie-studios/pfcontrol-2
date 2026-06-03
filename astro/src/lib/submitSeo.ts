import { SPA_SITE_URL } from './spaSeo';

export interface SubmitSessionSeoInput {
  sessionId: string;
  airportIcao: string;
  activeRunway?: string;
  isPFATC?: boolean;
  isAdvancedATC?: boolean;
  flightCount?: number;
  atisLetter?: string;
  atisText?: string;
  controllerUsername?: string;
}

export interface SubmitSessionSeo {
  pageTitle: string;
  ogTitle: string;
  pageDescription: string;
  keywords: string;
  pageUrl: string;
  ogImage: string;
  structuredData: object;
}

export function truncateMeta(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

export function normalizeAtisText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function resolveSubmitOgImage(
  siteOrigin: string,
  sessionId: string
): string {
  return `${siteOrigin}/api/og/submit/${encodeURIComponent(sessionId)}`;
}

function networkLabel(session: SubmitSessionSeoInput): string {
  if (session.isPFATC) return 'PFATC';
  if (session.isAdvancedATC) return 'Advanced ATC';
  return 'ATC';
}

export function buildSubmitSessionSeo(
  session: SubmitSessionSeoInput,
  siteOrigin: string
): SubmitSessionSeo {
  const icao = session.airportIcao?.toUpperCase() ?? 'Unknown';
  const network = networkLabel(session);
  const runway = session.activeRunway?.trim();
  const controller = session.controllerUsername?.trim();
  const atisLetter = session.atisLetter?.trim();
  const atisText = session.atisText ? normalizeAtisText(session.atisText) : '';
  const flightsN =
    typeof session.flightCount === 'number' ? session.flightCount : 0;

  const pageUrl = `${siteOrigin}/submit/${encodeURIComponent(session.sessionId)}`;
  const ogImage = resolveSubmitOgImage(siteOrigin, session.sessionId);

  const titleBits: string[] = [icao];
  if (atisLetter) titleBits.push(`ATIS ${atisLetter}`);
  titleBits.push(network);
  const pageTitle = truncateMeta(
    `${titleBits.join(' · ')} — Submit · PFControl`,
    70
  );
  const ogTitle = pageTitle;

  const contextParts: string[] = [icao, network];
  if (controller) contextParts.push(`Controller ${controller}`);
  if (runway) contextParts.push(`RWY ${runway}`);
  if (atisLetter) contextParts.push(`ATIS ${atisLetter}`);

  const descParts: string[] = [contextParts.join(' · ')];

  if (atisText) {
    const atisSnippet = truncateMeta(atisText, 180);
    descParts.push(
      atisLetter ? `INFO ${atisLetter}: ${atisSnippet}` : atisSnippet
    );
  }

  const boardLine =
    flightsN === 1
      ? '1 flight on the board'
      : `${flightsN.toLocaleString('en-US')} flights on the board`;
  descParts.push(`${boardLine} — File your flight plan on PFControl`);

  const pageDescription = truncateMeta(descParts.join(' — '), 320);

  const keywordParts = [
    'PFControl',
    'flight plan',
    'submit flight',
    'ATIS',
    network,
    icao,
    `${icao} ATIS`,
    'airport',
    'ATC',
    'VATSIM',
    String(session.sessionId),
  ];
  if (controller) {
    keywordParts.push(controller, `${controller} PFControl`);
  }
  if (runway) keywordParts.push(`runway ${runway}`);
  if (atisLetter) keywordParts.push(`ATIS ${atisLetter}`);

  const keywords = [...new Set(keywordParts)].join(', ');

  const airportNode: Record<string, unknown> = {
    '@type': 'Airport',
    '@id': `${pageUrl}#airport`,
    name: `${icao} — ${network} on PFControl`,
    icaoCode: icao,
  };
  if (runway) {
    airportNode.description = `Active runway ${runway}`;
  }

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': `${SPA_SITE_URL}/#website`,
      name: 'PFControl',
      url: SPA_SITE_URL,
      publisher: { '@id': `${SPA_SITE_URL}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${SPA_SITE_URL}/#organization`,
      name: 'PFControl',
      url: SPA_SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SPA_SITE_URL}/favicon.svg`,
      },
    },
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: pageTitle,
      description: pageDescription,
      isPartOf: { '@id': `${SPA_SITE_URL}/#website` },
      about: { '@id': `${pageUrl}#airport` },
      primaryImageOfPage: { '@type': 'ImageObject', url: ogImage },
      inLanguage: 'en',
      keywords: keywords.slice(0, 200),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'PFControl',
          item: siteOrigin,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: `Submit — ${icao}`,
          item: pageUrl,
        },
      ],
    },
    airportNode,
  ];

  if (controller) {
    graph.push({
      '@type': 'Person',
      '@id': `${pageUrl}#controller`,
      name: controller,
      url: `${siteOrigin}/user/${encodeURIComponent(controller)}`,
      jobTitle: `${network} Controller`,
    });
  }

  if (atisText) {
    graph.push({
      '@type': 'BroadcastService',
      '@id': `${pageUrl}#atis`,
      name: `${icao} ATIS${atisLetter ? ` ${atisLetter}` : ''}`,
      description: truncateMeta(atisText, 4000),
      broadcastTimezone: 'Etc/UTC',
      areaServed: { '@id': `${pageUrl}#airport` },
      ...(atisLetter && { alternateName: `ATIS ${atisLetter}` }),
    });
  }

  return {
    pageTitle,
    ogTitle,
    pageDescription,
    keywords,
    pageUrl,
    ogImage,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': graph,
    },
  };
}
