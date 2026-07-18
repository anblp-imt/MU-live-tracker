'use client';
import { usePathname } from 'next/navigation';
import { CompetitionFilterPills } from './CompetitionFilterPills';
import { useCompetitionFilter } from '@/contexts/CompetitionFilterContext';

// [React] Standings has its own local PL/CL/FA/EFL tabs (Task 26's deliberate
// local-state-vs-Context teaching contrast) — showing the shared nav pills there too
// reads as two competition selectors doing overlapping jobs. This conditional is the
// only change; CompetitionFilterContext and Standings' own useState tab are untouched.
export function NavFilterPills() {
  const pathname = usePathname();
  const { selected, setSelected } = useCompetitionFilter();
  if (pathname?.startsWith('/standings')) return null;
  return <CompetitionFilterPills selected={selected} onSelect={setSelected} />;
}
