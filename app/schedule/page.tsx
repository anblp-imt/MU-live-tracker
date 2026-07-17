'use client';
import { useEffect, useState } from 'react';
import type { CompetitionId, MatchesResponse } from '@/lib/types';
import { CompetitionFilterPills, type FilterValue } from '@/components/CompetitionFilterPills';
import { MatchList } from '@/components/MatchList';

export default function SchedulePage() {
  const [data, setData] = useState<MatchesResponse | null>(null);
  // [React] This state lives here — the nearest common parent of the pills and the list
  // below — because both siblings need to read/change it. Neither MatchList nor
  // CompetitionFilterPills owns it themselves.
  const [selected, setSelected] = useState<FilterValue>('ALL');

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
      <CompetitionFilterPills selected={selected} onSelect={setSelected} />
      <MatchList matches={filtered} emptyLabel="No matches for this competition" />
    </main>
  );
}
