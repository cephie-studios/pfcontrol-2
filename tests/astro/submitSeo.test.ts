import { describe, expect, it } from 'vitest';
import {
  buildSubmitSessionSeo,
  resolveSubmitOgImage,
} from '../../astro/src/lib/submitSeo';

describe('buildSubmitSessionSeo', () => {
  const siteOrigin = 'https://pfcontrol.com';

  it('puts ATIS text in the description after controller and runway context', () => {
    const seo = buildSubmitSessionSeo(
      {
        sessionId: '9824e8cc',
        airportIcao: 'LCPH',
        activeRunway: '29',
        isPFATC: true,
        flightCount: 22,
        atisLetter: 'B',
        atisText: 'LCPH ATIS B. RWY 29 IN USE. DEP RWY 29.',
        controllerUsername: 'bananensammler_',
      },
      siteOrigin
    );

    expect(seo.pageTitle).toContain('LCPH');
    expect(seo.pageTitle).toContain('ATIS B');
    expect(seo.pageDescription).toContain('Controller bananensammler_');
    expect(seo.pageDescription).toContain('RWY 29');
    expect(seo.pageDescription).toContain('INFO B:');
    expect(seo.pageDescription).toContain('RWY 29 IN USE');
    expect(seo.ogImage).toBe(
      `${siteOrigin}/api/og/submit/${encodeURIComponent('9824e8cc')}`
    );
    expect(seo.keywords).toContain('bananensammler_');
  });

  it('points OG image at dynamic submit card endpoint', () => {
    const image = resolveSubmitOgImage(siteOrigin, 'abc12345');
    expect(image).toBe(`${siteOrigin}/api/og/submit/abc12345`);
  });
});
