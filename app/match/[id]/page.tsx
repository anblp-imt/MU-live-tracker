'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { usePolling } from '@/hooks/usePolling';
import { FormationPitch } from '@/components/FormationPitch';
import { extractScorers } from '@/lib/merge';
import { displayTeamName } from '@/lib/normalize';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { EspnDetail } from '@/lib/types';
import styles from './page.module.css';

async function fetchDetail(espnId: string, slug: string): Promise<EspnDetail> {
  const res = await fetch(`/api/match/${espnId}?slug=${slug}`);
  if (!res.ok) throw new Error('Failed to load match detail');
  return res.json();
}

// [React] Pure formatter, tested through the page's own rendered output — same pattern
// as MatchCard's local statusLabel(), not extracted to lib/ since it's specific to this
// one page's header and not reused elsewhere.
function matchStatusText(detail: EspnDetail): string {
  const status = detail.header?.competitions?.[0]?.status;
  const state = status?.type?.state;
  if (state === 'post') return 'Full Time';
  if (state === 'in') {
    return status?.type?.name === 'STATUS_HALFTIME' ? 'Half Time' : `Live · ${status?.displayClock ?? ''}`;
  }
  return 'Kickoff soon';
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const espnId = searchParams.get('espnId');
  const slug = searchParams.get('slug');

  const [intervalMs, setIntervalMs] = useState<number | null>(null);
  const { data, error } = usePolling(
    () => (espnId && slug ? fetchDetail(espnId, slug) : Promise.reject(new Error('Match detail unavailable'))),
    intervalMs,
  );

  useEffect(() => {
    const state = data?.header?.competitions?.[0]?.status?.type?.state;
    // 'pre' must keep polling too, not just 'in' — otherwise a match opened before
    // kickoff fetches once, intervalMs stays null forever (no state change to trigger
    // the polling effect again), and the page is stuck showing "Kickoff soon" even
    // after the match goes live.
    setIntervalMs(state === 'in' || state === 'pre' ? 30_000 : null);
  }, [data]);

  if (!espnId || !slug) return <p>Match detail unavailable for this fixture.</p>;
  if (error) return <p role="alert">{error.message}</p>;
  if (!data) return <LoadingSpinner />;

  const headerComp = data.header?.competitions?.[0];
  const homeComp = headerComp?.competitors?.find(c => c.homeAway === 'home');
  const awayComp = headerComp?.competitors?.find(c => c.homeAway === 'away');
  const homeTeamEspnId = homeComp?.team?.id || '';
  const scorers = extractScorers(data, homeTeamEspnId);
  const rosters = data.rosters || [];
  const home = rosters.find(r => r.homeAway === 'home');
  const away = rosters.find(r => r.homeAway === 'away');

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Match #{params.id}</h1>
      <div className={styles.scoreHeader}>
        <span className={styles.teamName}>{displayTeamName(homeComp?.team?.displayName || '')}</span>
        <span className={styles.score}>{homeComp?.score ?? '-'} – {awayComp?.score ?? '-'}</span>
        <span className={styles.teamName}>{displayTeamName(awayComp?.team?.displayName || '')}</span>
      </div>
      <p className={styles.status}>{matchStatusText(data)}</p>
      <FormationPitch homeRoster={home} awayRoster={away} />
      <section className={styles.scorers}>
        <h2>Scorers</h2>
        <div>Home: {scorers.home.map(s => `${s.name} ${s.mins.join(', ')}`).join(' · ') || '—'}</div>
        <div>Away: {scorers.away.map(s => `${s.name} ${s.mins.join(', ')}`).join(' · ') || '—'}</div>
      </section>
    </main>
  );
}
