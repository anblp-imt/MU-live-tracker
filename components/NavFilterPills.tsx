'use client';
import { CompetitionFilterPills } from './CompetitionFilterPills';
import { useCompetitionFilter } from '@/contexts/CompetitionFilterContext';

export function NavFilterPills() {
  const { selected, setSelected } = useCompetitionFilter();
  return <CompetitionFilterPills selected={selected} onSelect={setSelected} />;
}
