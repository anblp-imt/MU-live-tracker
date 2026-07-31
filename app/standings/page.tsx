import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import StandingsClient from './StandingsClient';

export const metadata: Metadata = buildMetadata({
  title: 'Standings — Glory Glory Man United',
  description: "Manchester United's league position and cup group standings across every competition this season.",
  path: '/standings',
});

export default function StandingsPage() {
  return <StandingsClient />;
}
