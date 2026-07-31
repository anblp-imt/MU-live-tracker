import { describe, it, expect } from 'vitest';
import robots from './robots';
import { SITE_URL } from '@/lib/seo';

describe('robots', () => {
  it('allows all crawlers and points at the sitemap', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/' },
      sitemap: `${SITE_URL}/sitemap.xml`,
    });
  });
});
