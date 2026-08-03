import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/standings', '/stats', '/team', '/news'].map(path => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));
}
