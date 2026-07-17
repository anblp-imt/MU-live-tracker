import type { Match } from '@/lib/types';

// [React] No useMemo here, unlike FormationPitch (Task 24): this filter+sort runs over a
// handful of cup fixtures, and its result isn't handed to an expensive child — the cost
// of recomputing on every render is negligible. Reach for useMemo when profiling shows a
// real cost, not by default; see FormationPitch for the contrasting case.
export function CupRun({ matches, competition }: { matches: Match[]; competition: 'FA' | 'EFL' }) {
  const rounds = matches
    .filter(m => m.competition === competition)
    .slice()
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  if (rounds.length === 0) {
    return <p>No fixtures yet this season.</p>;
  }

  return (
    <ol data-testid="cup-run">
      {rounds.map(m => (
        <li key={m.id}>
          {new Date(m.utcDate).toLocaleDateString('en-GB')} — vs {m.venue === 'H' ? m.away.name : m.home.name} ({m.venue}) —{' '}
          {m.score.display.home ?? '-'}:{m.score.display.away ?? '-'}
        </li>
      ))}
    </ol>
  );
}
