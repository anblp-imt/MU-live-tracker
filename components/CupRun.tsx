// [React] No useMemo here, unlike FormationPitch: this filter+sort runs over a
// handful of cup fixtures, and its result isn't handed to an expensive child — the cost
// of recomputing on every render is negligible. Reach for useMemo when profiling shows a
// real cost, not by default; see FormationPitch for the contrasting case.
import type { Match } from '@/lib/types';
import styles from './CupRun.module.css';

export function CupRun({ matches, competition }: { matches: Match[]; competition: 'FA' | 'EFL' }) {
  const rounds = matches
    .filter(m => m.competition === competition)
    .slice()
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  if (rounds.length === 0) {
    return <p>No fixtures yet this season.</p>;
  }

  return (
    <ol data-testid="cup-run" className={styles.list}>
      {rounds.map(m => (
        <li key={m.id} className={styles.row}>
          <span>{new Date(m.utcDate).toLocaleDateString('en-GB')} — {m.venue === 'H' ? m.away.name : m.home.name} ({m.venue})</span>
          <span className={styles.score}>{m.score.display.home ?? '-'}:{m.score.display.away ?? '-'}</span>
        </li>
      ))}
    </ol>
  );
}
