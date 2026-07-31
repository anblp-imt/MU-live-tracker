import { describe, it, expect } from 'vitest';
import sitemap from './sitemap';
import { SITE_URL } from '@/lib/seo';

describe('sitemap', () => {
  it('lists exactly the 4 static routes', () => {
    const entries = sitemap();
    expect(entries.map(e => e.url)).toEqual([
      SITE_URL,
      `${SITE_URL}/standings`,
      `${SITE_URL}/stats`,
      `${SITE_URL}/team`,
    ]);
  });
});
