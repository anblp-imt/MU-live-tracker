'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { usePolling } from '@/hooks/usePolling';
import { FormationPitch } from '@/components/FormationPitch';
import { extractScorers } from '@/lib/merge';
import type { EspnDetail } from '@/lib/types';

async function fetchDetail(espnId: string, slug: string): Promise<EspnDetail> {
  const res = await fetch(`/api/match/${espnId}?slug=${slug}`);
  if (!res.ok) throw new Error('Failed to load match detail');
  return res.json();
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
    setIntervalMs(state === 'in' ? 30_000 : null);
  }, [data]);

  if (!espnId || !slug) return <p>Match detail unavailable for this fixture.</p>;
  if (error) return <p role="alert">{error.message}</p>;
  if (!data) return <p>Loading...</p>;

  const headerComp = data.header?.competitions?.[0];
  const homeTeamEspnId = headerComp?.competitors?.find(c => c.homeAway === 'home')?.team?.id || '';
  const scorers = extractScorers(data, homeTeamEspnId);
  const rosters = data.rosters || [];
  const home = rosters.find(r => r.homeAway === 'home');
  const away = rosters.find(r => r.homeAway === 'away');

  return (
    <main>
      <h1>Match #{params.id}</h1>
      <FormationPitch homeRoster={home} awayRoster={away} />
      <section>
        <h2>Scorers</h2>
        <div>Home: {scorers.home.map(s => `${s.name} ${s.mins.join(', ')}`).join(' · ') || '—'}</div>
        <div>Away: {scorers.away.map(s => `${s.name} ${s.mins.join(', ')}`).join(' · ') || '—'}</div>
      </section>
    </main>
  );
}
