'use client';
import { useEffect, useState } from 'react';
import { usePolling } from '@/hooks/usePolling';
import { pollingIntervalForMatches } from '@/lib/polling';
import { MatchList } from '@/components/MatchList';
import { PageHeading } from '@/components/PageHeading';
import type { MatchesResponse } from '@/lib/types';
import styles from './page.module.css';

async function fetchMatches(): Promise<MatchesResponse> {
  const res = await fetch('/api/matches');
  if (!res.ok) throw new Error('Failed to load matches');
  return res.json();
}

export default function TodayPage() {
  // 5 minutes is a safe default before we know whether anything is live; once the first
  // response arrives, the effect below recomputes the real interval.
  const [intervalMs, setIntervalMs] = useState<number | null>(300_000);
  const { data, error } = usePolling(fetchMatches, intervalMs);

  // [React] This effect reacts to `data` changing (a state update from the usePolling
  // hook above) by triggering *another* state update (setIntervalMs), which in turn
  // changes usePolling's own intervalMs prop and restarts its interval effect. Chaining
  // effects like this is a normal, if easy-to-miss, React pattern — see LEARNING.md.
  useEffect(() => {
    if (data) setIntervalMs(pollingIntervalForMatches(data.matches));
  }, [data]);

  if (error && !data) return <p role="alert">{error.message}</p>;
  if (!data) return <p>Loading...</p>;

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMatches = data.matches.filter(m => m.utcDate.slice(0, 10) === todayKey);

  return (
    <main className={styles.main}>
      <PageHeading title="Today" />
      {error && <p role="alert">Showing last known data — refresh failed</p>}
      {!data.meta.sources.espn && <p role="status">ESPN enrichment unavailable — showing football-data only</p>}
      <MatchList matches={todayMatches} emptyLabel="No Manchester United match today" />
    </main>
  );
}
