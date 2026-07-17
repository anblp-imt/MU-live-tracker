import Link from 'next/link';
import type { Match } from '@/lib/types';
import { getCompetition } from '@/lib/competitions';
import styles from './MatchCard.module.css';

const CLICKABLE_STATUSES: Match['status'][] = ['IN_PLAY', 'PAUSED', 'FINISHED'];

// Replaced by the real implementation from components/LiveBadge.tsx in Task 20 — this
// stub keeps MatchCard buildable/testable before that file exists.
function isFergieTime(_match: Match): boolean {
  return false;
}

function statusLabel(match: Match): string {
  if (match.status === 'IN_PLAY') return isFergieTime(match) ? 'FERGIE TIME' : `${match.minute ?? ''}'`;
  if (match.status === 'PAUSED') return 'HT';
  if (match.status === 'FINISHED') return 'FT';
  if (match.status === 'POSTPONED') return 'Postponed';
  return new Date(match.utcDate).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

export function MatchCard({ match }: { match: Match }) {
  const opponent = match.venue === 'H' ? match.away.name : match.home.name;
  const clickable = CLICKABLE_STATUSES.includes(match.status);

  const content = (
    <div className={styles.card} data-testid="match-card">
      <span className={styles.opponent}>vs {opponent} ({match.venue})</span>
      <span>{match.score.display.home ?? '-'} : {match.score.display.away ?? '-'}</span>
      <span>{statusLabel(match)}</span>
    </div>
  );

  if (!clickable) return content;

  const slug = getCompetition(match.competition).espnSlug;
  return (
    <Link href={`/match/${match.id}?espnId=${match.sources.espn ?? ''}&slug=${slug}`}>
      {content}
    </Link>
  );
}
