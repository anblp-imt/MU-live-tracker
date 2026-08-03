import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import NewsClient from './NewsClient';

export const metadata: Metadata = buildMetadata({
  title: 'News — Glory Glory Man United',
  description: 'Latest Manchester United news from BBC Sport, The Guardian and ESPN.',
  path: '/news',
});

export default function NewsPage() {
  return <NewsClient />;
}
