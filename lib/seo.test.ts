import { describe, it, expect } from 'vitest';
import { buildMetadata, buildJsonLd, SITE_URL, SITE_NAME } from './seo';

describe('buildMetadata', () => {
  it('builds a complete Metadata object with matching title/description everywhere', () => {
    const result = buildMetadata({
      title: 'Standings — Glory Glory Man United',
      description: 'Test description.',
      path: '/standings',
    });

    expect(result.title).toBe('Standings — Glory Glory Man United');
    expect(result.description).toBe('Test description.');
    expect(result.alternates).toEqual({ canonical: `${SITE_URL}/standings` });

    expect(result.openGraph).toMatchObject({
      title: 'Standings — Glory Glory Man United',
      description: 'Test description.',
      url: `${SITE_URL}/standings`,
      siteName: SITE_NAME,
      locale: 'en_US',
      type: 'website',
    });
    expect(result.openGraph?.images).toEqual([
      { url: '/mu-bg.jpg', width: 1536, height: 1024, alt: 'Manchester United' },
    ]);

    expect(result.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Standings — Glory Glory Man United',
      description: 'Test description.',
      images: ['/mu-bg.jpg'],
    });
  });

  it('resolves the root path without a double slash', () => {
    const result = buildMetadata({ title: 'Home', description: 'x', path: '/' });
    expect(result.alternates).toEqual({ canonical: SITE_URL });
    expect(result.openGraph?.url).toBe(SITE_URL);
  });
});

describe('buildJsonLd', () => {
  it('returns a WebSite + SportsTeam graph', () => {
    const jsonLd = buildJsonLd() as { '@context': string; '@graph': Array<{ '@type': string }> };
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@graph']).toEqual([
      { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
      { '@type': 'SportsTeam', name: 'Manchester United', sport: 'Soccer', url: SITE_URL },
    ]);
  });
});
