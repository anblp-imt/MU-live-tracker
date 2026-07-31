import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import TeamClient from './TeamClient';

export const metadata: Metadata = buildMetadata({
  title: 'Squad — Glory Glory Man United',
  description: "Manchester United's full first-team roster by position, with shirt numbers and nationalities.",
  path: '/team',
});

export default function TeamPage() {
  return <TeamClient />;
}
