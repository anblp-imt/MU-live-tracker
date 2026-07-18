'use client';
import { useEffect, useState } from 'react';
import type { Match, MatchesResponse, StandingRow } from '@/lib/types';
import { CupRun } from '@/components/CupRun';

type Tab = 'PL' | 'CL' | 'FA' | 'EFL';

export default function StandingsPage() {
  // [React] This tab lives only on this page. Reusing CompetitionFilterContext (Task 22)
  // here would couple two unrelated UI concerns for no benefit — local useState is the
  // right tool when a piece of state doesn't need to escape the component that owns it.
  const [tab, setTab] = useState<Tab>('PL');
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    fetch('/api/matches').then(res => res.json()).then((json: MatchesResponse) => setMatches(json.matches));
  }, []);

  useEffect(() => {
    if (tab !== 'PL' && tab !== 'CL') { setStandings(null); return; }
    let cancelled = false;
    setStandings(null);
    fetch(`/api/standings?comp=${tab}`)
      .then(res => res.json())
      .then((json: { standings: StandingRow[] }) => { if (!cancelled) setStandings(json.standings); });
    return () => { cancelled = true; };
  }, [tab]);

  return (
    <main>
      <h1>Standings</h1>
      <div role="tablist">
        {(['PL', 'CL', 'FA', 'EFL'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {(tab === 'PL' || tab === 'CL') && (
        standings ? (
          <table>
            <tbody>
              {standings.map(row => (
                <tr key={row.team.name}>
                  <td>{row.position}</td>
                  <td>{row.team.name}</td>
                  <td>{row.playedGames}</td>
                  <td>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>Loading...</p>
      )}
      {(tab === 'FA' || tab === 'EFL') && <CupRun matches={matches} competition={tab} />}
    </main>
  );
}
