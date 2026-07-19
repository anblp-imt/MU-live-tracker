'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { usePolling } from '@/hooks/usePolling';
import { FormationPitch } from '@/components/FormationPitch';
import { extractScorers, extractStats, extractSubstitutions, extractShootout } from '@/lib/merge';
import { displayTeamName } from '@/lib/normalize';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { LIVE_TTL_MS, STATIC_TTL_MS } from '@/lib/cache';
import type { EspnDetail } from '@/lib/types';
import styles from './page.module.css';

// A live match's detail is stale in 30s; a not-yet-started or finished one barely
// changes and can be held far longer (matches the STATIC_TTL_MS the server route and
// the Standings page already use for equally slow-moving data).
function detailTtlMs(detail: EspnDetail): number {
  const state = detail.header?.competitions?.[0]?.status?.type?.state;
  return state === 'in' ? LIVE_TTL_MS : STATIC_TTL_MS;
}

async function fetchDetail(espnId: string, slug: string): Promise<EspnDetail> {
  const res = await fetch(`/api/match/${espnId}?slug=${slug}`);
  if (!res.ok) throw new Error('Failed to load match detail');
  return res.json();
}

function formatSyncTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
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

// Same dark-mode-variant preference as FormationPitch.tsx's jerseyKitUrl — a dark-on-
// transparent crest suits this page's dark background better than ESPN's default
// (light-background) render, when ESPN provides one at all.
function teamCrestUrl(team: { logos?: Array<{ href: string; rel?: string[] }> } | undefined): string | undefined {
  const logos = team?.logos || [];
  return logos.find(l => l.rel?.includes('dark'))?.href || logos[0]?.href;
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const espnId = searchParams.get('espnId');
  const slug = searchParams.get('slug');

  const [intervalMs, setIntervalMs] = useState<number | null>(null);
  // Keyed the same way as the server route's own cache (app/api/match/[id]/route.ts) so
  // re-opening the same fixture — e.g. back out to Today and click back in — renders
  // instantly from the last-known detail instead of a fresh loading spinner, while still
  // refreshing in the background.
  const { data, error, loading, refetch, lastSyncedAt } = usePolling(
    () => (espnId && slug ? fetchDetail(espnId, slug) : Promise.reject(new Error('Match detail unavailable'))),
    intervalMs,
    espnId && slug ? { key: `match-detail:${slug}:${espnId}`, ttlMs: detailTtlMs } : undefined,
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
  if (error && !data) return <p role="alert">{error.message}</p>;
  if (!data) return <LoadingSpinner />;

  const headerComp = data.header?.competitions?.[0];
  const homeComp = headerComp?.competitors?.find(c => c.homeAway === 'home');
  const awayComp = headerComp?.competitors?.find(c => c.homeAway === 'away');
  const homeTeamEspnId = homeComp?.team?.id || '';
  const scorers = extractScorers(data, homeTeamEspnId);
  const stats = extractStats(data);
  const subs = extractSubstitutions(data, homeTeamEspnId);
  const shootout = extractShootout(data, homeTeamEspnId);
  const rosters = data.rosters || [];
  const home = rosters.find(r => r.homeAway === 'home');
  const away = rosters.find(r => r.homeAway === 'away');
  const matchState = headerComp?.status?.type?.state;
  const subCount = subs.home.length + subs.away.length;

  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Match #{params.id}</h1>
        <div className={styles.refreshGroup}>
          {!loading && error && <span className={styles.syncErr} data-testid="sync-status">✗ Refresh failed</span>}
          {!loading && !error && lastSyncedAt != null && (
            <span className={styles.syncOk} data-testid="sync-status">✓ Synced {formatSyncTime(lastSyncedAt)}</span>
          )}
          <button type="button" className={styles.refreshBtn} onClick={refetch} disabled={loading}>
            <span className={loading ? styles.spinning : undefined} aria-hidden="true">↻</span> Refresh
          </button>
        </div>
      </div>
      <div className={styles.scoreHeader}>
        <div className={styles.teamBlock} style={{ '--team-accent': homeComp?.team?.color ? `#${homeComp.team.color}` : 'var(--mu-red)' } as React.CSSProperties}>
          {teamCrestUrl(homeComp?.team) && (
            <img className={styles.crest} src={teamCrestUrl(homeComp?.team)} alt={`${homeComp?.team?.displayName} crest`} loading="lazy" />
          )}
          <span className={styles.teamName}>{displayTeamName(homeComp?.team?.displayName || '')}</span>
        </div>
        <span className={styles.score}>{homeComp?.score ?? '-'} – {awayComp?.score ?? '-'}</span>
        <div className={styles.teamBlock} style={{ '--team-accent': awayComp?.team?.color ? `#${awayComp.team.color}` : 'var(--mu-gold)' } as React.CSSProperties}>
          <span className={styles.teamName}>{displayTeamName(awayComp?.team?.displayName || '')}</span>
          {teamCrestUrl(awayComp?.team) && (
            <img className={styles.crest} src={teamCrestUrl(awayComp?.team)} alt={`${awayComp?.team?.displayName} crest`} loading="lazy" />
          )}
        </div>
      </div>
      <p className={styles.status}>{matchStatusText(data)}</p>
      {/* key={matchState} remounts only when pre/in/post actually changes, resetting
          the default open/closed state at that transition — a poll within the same
          phase re-renders without remounting, so a manual toggle by the user survives
          it instead of snapping back open/closed every 30s. */}
      <details key={matchState} open={matchState === 'pre'}>
        <summary className={styles.lineupSummary}>Starting Lineup</summary>
        <FormationPitch homeRoster={home} awayRoster={away} />
      </details>
      <section className={styles.scorers}>
        <h2>Scorers</h2>
        <div>Home: {scorers.home.map(s => `${s.name} ${s.mins.join(', ')}`).join(' · ') || '—'}</div>
        <div>Away: {scorers.away.map(s => `${s.name} ${s.mins.join(', ')}`).join(' · ') || '—'}</div>
      </section>
      {shootout && (
        <section className={styles.shootout} data-testid="shootout">
          <h2>Penalty Shootout <span className={styles.shootoutScore}>{shootout.homeScore} – {shootout.awayScore}</span></h2>
          <div className={styles.shootoutGrid}>
            {shootout.rounds.map((round, i) => (
              <div className={styles.shootoutRow} key={i}>
                <span className={`${styles.shootoutShot} ${styles.shootoutHome} ${round.home ? (round.home.scored ? styles.scored : styles.missed) : ''}`}>
                  {round.home ? `${round.home.scored ? '✓' : '✗'} ${round.home.player}` : ''}
                </span>
                <span className={styles.shootoutRound}>{i + 1}</span>
                <span className={`${styles.shootoutShot} ${styles.shootoutAway} ${round.away ? (round.away.scored ? styles.scored : styles.missed) : ''}`}>
                  {round.away ? `${round.away.scored ? '✓' : '✗'} ${round.away.player}` : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      {stats.length > 0 && (
        <section className={styles.stats} data-testid="stats">
          <h2>Match Stats</h2>
          {stats.map(row => {
            const total = row.home.value + row.away.value;
            const homePct = total ? (row.home.value / total) * 100 : 50;
            return (
              <div className={styles.statRow} key={row.label}>
                <div className={styles.statVals}>
                  <span className={styles.statHome}>{row.home.display}</span>
                  <span className={styles.statLabel}>{row.label}</span>
                  <span className={styles.statAway}>{row.away.display}</span>
                </div>
                <div className={styles.statBar}>
                  <span className={styles.statBarHome} style={{ width: `${homePct}%` }} />
                  <span className={styles.statBarAway} style={{ width: `${100 - homePct}%` }} />
                </div>
              </div>
            );
          })}
        </section>
      )}
      {subCount > 0 && (
        <details className={styles.subsDetails} data-testid="substitutions">
          <summary className={styles.lineupSummary}>{subCount} Substitution{subCount === 1 ? '' : 's'}</summary>
          <div className={styles.subsGrid}>
            <div>
              {subs.home.map((s, i) => (
                <div className={styles.subRow} key={i}>
                  <span className={styles.subMin}>{s.min}</span>
                  <span><span className={styles.subIn}>↑</span> {s.playerIn} <span className={styles.subOut}>↓ {s.playerOut}</span></span>
                </div>
              ))}
            </div>
            <div>
              {subs.away.map((s, i) => (
                <div className={styles.subRow} key={i}>
                  <span className={styles.subMin}>{s.min}</span>
                  <span><span className={styles.subIn}>↑</span> {s.playerIn} <span className={styles.subOut}>↓ {s.playerOut}</span></span>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </main>
  );
}
