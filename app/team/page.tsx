import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import TeamClient from './TeamClient';

export const metadata: Metadata = buildMetadata({
  title: 'Team — Glory Glory Man United',
  description: "Manchester United's current first-team squad, grouped by position.",
  path: '/team',
});

export default function TeamPage() {
  return <TeamClient />;
}
