import type { Match } from './types';

// MU's own result for one match, from MU's perspective (venue-aware, since `home`/`away`
// name whichever club is actually playing at home — not always MU). null covers both "not
// played yet" and the defensive case of a FINISHED match somehow missing a score.
export function matchResult(m: Match): 'W' | 'D' | 'L' | null {
  if (m.status !== 'FINISHED') return null;
  const muScore = m.venue === 'H' ? m.score.display.home : m.score.display.away;
  const oppScore = m.venue === 'H' ? m.score.display.away : m.score.display.home;
  if (muScore === null || oppScore === null) return null;
  if (muScore === oppScore) return 'D';
  return muScore > oppScore ? 'W' : 'L';
}
