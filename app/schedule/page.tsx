'use client';
import { useEffect, useState } from 'react';
import type { CompetitionId, MatchesResponse } from '@/lib/types';
import { COMPETITIONS } from '@/lib/competitions';
import { MatchList } from '@/components/MatchList';
import { PageHeading } from '@/components/PageHeading';
import styles from './page.module.css';

type FilterValue = CompetitionId | 'ALL';

// [React] This filter used to live in a Context shared with the nav (Task 22 of the
// original plan) so the same selection could be read from both the layout header and
// this page. That need went away once the nav pills were dropped from Today and
// Standings (both show at most one match / their own local tabs) — Schedule is now the
// only place this filter is meaningful, so it's back to plain local `useState`, the
// same "lift state up no higher than needed" idea Task 18 first introduced.
export default function SchedulePage() {
  const [selected, setSelected] = useState<FilterValue>('ALL');
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
    <main className={styles.main}>
      <PageHeading title="Schedule" />
      <div role="tablist" className={styles.tabs}>
        <button role="tab" aria-selected={selected === 'ALL'} onClick={() => setSelected('ALL')} className={styles.tab}>ALL</button>
        {COMPETITIONS.map(c => (
          <button key={c.id} role="tab" aria-selected={selected === c.id} onClick={() => setSelected(c.id)} className={styles.tab}>
            {c.navShortLabel}
          </button>
        ))}
      </div>
      <MatchList matches={filtered} emptyLabel="No matches for this competition" />
    </main>
  );
}
