'use client';
import { useEffect, useState } from 'react';
import type { MatchesResponse } from '@/lib/types';
import { MatchList } from '@/components/MatchList';

export default function TodayPage() {
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // [React] `cancelled` guards against setting state after this effect's cleanup has
    // already run (e.g. the user navigated away before the fetch resolved) — without it,
    // React warns about updating an unmounted component and you can get a stale write.
    let cancelled = false;
    fetch('/api/matches')
      .then(res => res.json())
      .then((json: MatchesResponse) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setError('Failed to load matches'); });
    return () => { cancelled = true; };
  }, []); // [React] empty dependency array = run once after the first render, like componentDidMount.

  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Loading...</p>;

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMatches = data.matches.filter(m => m.utcDate.slice(0, 10) === todayKey);

  return (
    <main>
      <h1>Today</h1>
      <MatchList matches={todayMatches} emptyLabel="No Manchester United match today" />
    </main>
  );
}
