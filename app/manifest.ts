import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: 'Glory Glory',
    description: 'Live scores, schedule, standings, and season stats for Manchester United.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d0d0d',
    theme_color: '#0d0d0d',
    icons: [
      {
        src: '/icon.png',
        sizes: '600x600',
        type: 'image/png',
      },
    ],
  };
}
