import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/standings', '/stats', '/team'].map(path => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));
}
