// components/LiveBadge.tsx
import type { Match } from '@/lib/types';

// MU flavor: minute 90+ while drawing or losing gets a distinct badge — a nod to
// stoppage-time drama, not a football-data/ESPN concept. `parseInt` on "90'+3'" stops at
// the first non-digit character and correctly returns 90.
export function isFergieTime(match: Match): boolean {
  if (match.status !== 'IN_PLAY') return false;
  const minute = parseInt(match.minute || '', 10);
  if (Number.isNaN(minute) || minute < 90) return false;
  const muScore = match.venue === 'H' ? match.score.display.home : match.score.display.away;
  const oppScore = match.venue === 'H' ? match.score.display.away : match.score.display.home;
  if (muScore === null || oppScore === null) return false;
  return muScore <= oppScore;
}

export function LiveBadge({ match }: { match: Match }) {
  if (match.status !== 'IN_PLAY' && match.status !== 'PAUSED') return null;
  if (match.status === 'PAUSED') return <span className="badge-ht">HT</span>;
  if (isFergieTime(match)) return <span className="badge-fergie">FERGIE TIME</span>;
  return <span className="badge-live">{match.minute}&apos;</span>;
}
