'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompetitionId, Match, MatchesResponse, StandingRow } from '@/lib/types';
import { CupRun } from '@/components/CupRun';
import { PageHeading } from '@/components/PageHeading';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { displayTeamName, isManUtd } from '@/lib/normalize';
import { recentForm, standingsAroundMu } from '@/lib/standings';
import { COMPETITIONS, getCompetition, visibleCompetitions } from '@/lib/competitions';
import { usePolling } from '@/hooks/usePolling';
import { getCached, setCached, LIVE_TTL_MS, STATIC_TTL_MS } from '@/lib/cache';
import styles from './page.module.css';

type Tab = Exclude<CompetitionId, 'FRIENDLY'>;

async function fetchMatches(): Promise<MatchesResponse> {
  const res = await fetch('/api/matches');
  if (!res.ok) throw new Error('Failed to load matches');
  return res.json();
}

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
  const {
    data: matchesData, loading: matchesLoading, refetch: refetchMatches,
    lastSyncedAt: matchesSyncedAt, error: matchesError,
  } = usePolling(fetchMatches, null, { key: 'matches', ttlMs: LIVE_TTL_MS });
  const matches: Match[] = matchesData?.matches ?? [];
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsSyncedAt, setStandingsSyncedAt] = useState<number | null>(null);
  const [standingsError, setStandingsError] = useState<Error | null>(null);

  // [React] Guards against a stale response clobbering a newer one — e.g. tab flips
  // PL -> CL -> PL fast enough that the first PL request is still in flight when the
  // second one starts. Each call claims the next id; a response only gets applied if
  // it's still the most recent one requested by the time it resolves.
  const requestIdRef = useRef(0);

  // TTL matches the server route's own cache (app/api/standings/route.ts): a league
  // table only moves when a match finishes, not every 30s like a live score, so it can
  // be held far longer than the 'matches' cache above. Exposed as its own function (not
  // folded into usePolling, which only handles one fetch per hook instance) so both the
  // tab-change effect below and the manual Refresh button can trigger it.
  const loadStandings = useCallback((selectedTab: Tab) => {
    if (!getCompetition(selectedTab).hasStandings) return;
    const requestId = ++requestIdRef.current;
    const cacheKey = `standings:${selectedTab}`;
    setStandingsLoading(true);
    fetch(`/api/standings?comp=${selectedTab}`)
      .then(res => res.json())
      .then((json: { standings: StandingRow[] }) => {
        if (requestIdRef.current !== requestId) return;
        setStandings(json.standings);
        setStandingsSyncedAt(Date.now());
        setStandingsError(null);
        setCached(cacheKey, json.standings, STATIC_TTL_MS);
      })
      .catch((e: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setStandingsError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => { if (requestIdRef.current === requestId) setStandingsLoading(false); });
  }, []);

  // Seeded from the same client cache module the Today/Schedule pages write to (and that
  // loadStandings itself writes to) — switching PL -> CL -> PL no longer blanks back to a
  // spinner if a fresh-enough copy of that tab's standings is already cached.
  useEffect(() => {
    if (!getCompetition(tab).hasStandings) { setStandings(null); return; }
    setStandings(getCached<StandingRow[]>(`standings:${tab}`) ?? null);
    loadStandings(tab);
  }, [tab, loadStandings]);

  const refreshAll = () => {
    refetchMatches();
    loadStandings(tab);
  };

  // Only MU's own finished matches produce real form data (the app has no other club's
  // match history) — used on MU's row only; every other row shows a placeholder.
  const muForm = getCompetition(tab).hasStandings ? recentForm(matches, tab, 5) : [];

  return (
    <main className={styles.main}>
      <PageHeading
        title="Standings"
        onRefresh={refreshAll}
        refreshing={matchesLoading || standingsLoading}
        lastSyncedAt={Math.max(matchesSyncedAt ?? 0, standingsSyncedAt ?? 0) || null}
        error={matchesError || standingsError}
      />
      <div role="tablist" className={styles.tabs}>
        {visibleCompetitions(matches, COMPETITIONS.filter(c => c.id !== 'FRIENDLY')).map(c => (
          // TS can't narrow CompetitionId -> Tab through .filter(), but the `from` list
          // above already excludes 'FRIENDLY' (Tab's only excluded case), so c.id is
          // always a valid Tab value here.
          <button key={c.id} role="tab" aria-selected={tab === c.id} onClick={() => setTab(c.id as Tab)} className={styles.tab}>
            {c.navShortLabel}
          </button>
        ))}
      </div>
      {getCompetition(tab).hasStandings && (
        standings ? (
          <>
            {tab === 'CL' && standingsAroundMu(standings, 2).length > 0 && (
              <div className={styles.highlightBlock} data-testid="cl-highlight">
                <p className={styles.highlightLabel}>Red Devils&apos; Position</p>
                <ul className={styles.highlightList}>
                  {standingsAroundMu(standings, 2).map(row => {
                    const isMu = isManUtd(row.team.name);
                    return (
                      <li key={row.team.name} className={isMu ? styles.muRow : undefined}>
                        <span className={styles.position}>{row.position}</span>
                        <span className={styles.rowMain}>
                          <span className={isMu ? styles.muName : undefined}>{displayTeamName(row.team.name)}</span>
                        </span>
                        <span className={styles.rowStats}>
                          <span className={styles.points}>{row.points}</span>
                          <span className={styles.played}>{row.playedGames} played</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <table className={styles.tableDesktop}>
              <thead>
                <tr>
                  <th>#</th><th>Team</th><th>P</th><th>Form</th><th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(row => {
                  const isMu = isManUtd(row.team.name);
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
                const isMu = isManUtd(row.team.name);
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
        ) : <LoadingSpinner />
      )}
      {/* Only PL/CL have hasStandings: true (lib/competitions.ts), and 'FRIENDLY' is
          already excluded from Tab — so inside this !hasStandings branch, tab can only
          be 'FA' | 'EFL' | 'EL' | 'ECL', exactly CupRun's prop type. */}
      {!getCompetition(tab).hasStandings && <CupRun matches={matches} competition={tab as 'FA' | 'EFL' | 'EL' | 'ECL'} />}
    </main>
  );
}
