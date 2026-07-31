import type { Metadata } from 'next';

export const SITE_URL = 'https://gloryglory.vercel.app';
export const SITE_NAME = 'Glory Glory Man United';
export const DEFAULT_DESCRIPTION = 'Live scores, schedule, standings, and season stats for Manchester United.';
export const DEFAULT_OG_IMAGE = { url: '/mu-bg.jpg', width: 1536, height: 1024, alt: 'Manchester United' };

interface BuildMetadataInput {
  title: string;
  description: string;
  // Route path, e.g. '/standings' or '/' — resolved against SITE_URL for canonical/OG urls.
  path: string;
}

// Next.js does not deep-merge a child route's `openGraph`/`twitter` objects with the
// parent layout's — a route that defines either fully replaces it. Every route that
// overrides metadata must go through this helper so it always gets the complete block.
export function buildMetadata({ title, description, path }: BuildMetadataInput): Metadata {
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [DEFAULT_OG_IMAGE],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}

export function buildJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
      { '@type': 'SportsTeam', name: 'Manchester United', sport: 'Soccer', url: SITE_URL },
    ],
  };
}
