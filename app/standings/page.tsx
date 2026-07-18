'use client';
import { useEffect, useState } from 'react';
import type { Match, MatchesResponse, StandingRow } from '@/lib/types';
import { CupRun } from '@/components/CupRun';
import { PageHeading } from '@/components/PageHeading';
import { displayTeamName } from '@/lib/normalize';
import { recentForm } from '@/lib/standings';
import styles from './page.module.css';

type Tab = 'PL' | 'CL' | 'FA' | 'EFL';

function FormDots({ form }: { form: ('W' | 'D' | 'L')[] }) {
  if (form.length === 0) return <span className={styles.formPlaceholder}>—</span>;
  return (
    <span className={styles.formDots}>
      {form.map((r, i) => (
        <span key={i} className={`${styles.dot} ${r === 'W' ? styles.dotW : r === 'D' ? styles.dotD : styles.dotL}`}>{r}</span>
      ))}
    </span>
  );
}

export default function StandingsPage() {
  // [React] This tab lives only on this page — local useState is the right tool when a
  // piece of state doesn't need to escape the component that owns it. (An earlier
  // version of this codebase had a Context sharing a competition filter between the
  // layout nav and Schedule; it was removed once Today/Standings stopped needing a
  // filter at all, leaving Schedule as Context's only remaining consumer — see
  // LEARNING.md section 4 for what that removal taught.)
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

  // Only MU's own finished matches produce real form data (the app has no other club's
  // match history) — used on MU's row only; every other row shows a placeholder.
  const muForm = (tab === 'PL' || tab === 'CL') ? recentForm(matches, tab, 5) : [];

  return (
    <main className={styles.main}>
      <PageHeading title="Standings" />
      <div role="tablist" className={styles.tabs}>
        {(['PL', 'CL', 'FA', 'EFL'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={styles.tab}>{t}</button>
        ))}
      </div>
      {(tab === 'PL' || tab === 'CL') && (
        standings ? (
          <>
            <table className={styles.tableDesktop}>
              <thead>
                <tr>
                  <th>#</th><th>Team</th><th>P</th><th>Form</th><th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(row => {
                  const isMu = displayTeamName(row.team.name) === 'Red Devils';
                  return (
                    <tr key={row.team.name} className={isMu ? styles.muRow : undefined}>
                      <td>{row.position}</td>
                      <td className={isMu ? styles.muName : undefined}>{displayTeamName(row.team.name)}</td>
                      <td>{row.playedGames}</td>
                      <td>{isMu ? <FormDots form={muForm} /> : <span className={styles.formPlaceholder}>—</span>}</td>
                      <td>{row.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ul className={styles.listMobile}>
              {standings.map(row => {
                const isMu = displayTeamName(row.team.name) === 'Red Devils';
                return (
                  <li key={row.team.name} className={isMu ? styles.muRow : undefined}>
                    <span className={styles.position}>{row.position}</span>
                    <span className={styles.rowMain}>
                      <span className={isMu ? styles.muName : undefined}>{displayTeamName(row.team.name)}</span>
                      {isMu ? <FormDots form={muForm} /> : <span className={styles.formPlaceholder}>—</span>}
                    </span>
                    <span className={styles.rowStats}>
                      <span className={styles.points}>{row.points}</span>
                      <span className={styles.played}>{row.playedGames} played</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : <p>Loading...</p>
      )}
      {(tab === 'FA' || tab === 'EFL') && <CupRun matches={matches} competition={tab} />}
    </main>
  );
}
