'use client';
import { useEffect, useState } from 'react';
import type { CompetitionId, MatchesResponse } from '@/lib/types';
import { useCompetitionFilter } from '@/contexts/CompetitionFilterContext';
import { MatchList } from '@/components/MatchList';

export default function SchedulePage() {
  const { selected } = useCompetitionFilter();
  const [data, setData] = useState<MatchesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/matches').then(res => res.json()).then((json: MatchesResponse) => {
      if (!cancelled) setData(json);
    });
    return () => { cancelled = true; };
  }, []);

  if (!data) return <p>Loading...</p>;
  const filtered: typeof data.matches = selected === 'ALL'
    ? data.matches
    : data.matches.filter(m => m.competition === (selected as CompetitionId));

  return (
    <main>
      <h1>Schedule</h1>
      <MatchList matches={filtered} emptyLabel="No matches for this competition" />
    </main>
  );
}
