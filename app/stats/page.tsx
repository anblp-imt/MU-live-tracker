import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import StatsClient from './StatsClient';

export const metadata: Metadata = buildMetadata({
  title: 'Season Stats — Glory Glory Man United',
  description: 'Top scorers, assists, and season leaderboard for Manchester United across every competition.',
  path: '/stats',
});

export default function StatsPage() {
  return <StatsClient />;
}
