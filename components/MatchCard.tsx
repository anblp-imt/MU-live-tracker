import Link from 'next/link';
import type { Match } from '@/lib/types';
import { getCompetition } from '@/lib/competitions';
import { LiveBadge } from './LiveBadge';
import styles from './MatchCard.module.css';

const CLICKABLE_STATUSES: Match['status'][] = ['IN_PLAY', 'PAUSED', 'FINISHED'];
const LIVE_STATUSES: Match['status'][] = ['IN_PLAY', 'PAUSED'];

function statusLabel(match: Match): string {
  if (match.status === 'FINISHED') return 'FT';
  if (match.status === 'POSTPONED') return 'Postponed';
  return new Date(match.utcDate).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function cardStateClass(match: Match): string {
  if (LIVE_STATUSES.includes(match.status)) return styles.live;
  if (match.status === 'FINISHED') return styles.finished;
  return styles.scheduled;
}

export function MatchCard({ match }: { match: Match }) {
  const opponent = match.venue === 'H' ? match.away.name : match.home.name;
  const clickable = CLICKABLE_STATUSES.includes(match.status);
  const isLive = LIVE_STATUSES.includes(match.status);

  const content = (
    <div className={`${styles.card} ${cardStateClass(match)}`} data-testid="match-card">
      {isLive && (
        <div className={styles.stamp}>
          <LiveBadge match={match} />
        </div>
      )}
      <span className={styles.opponent}>vs {opponent} ({match.venue})</span>
      <span className={styles.score}>{match.score.display.home ?? '-'} : {match.score.display.away ?? '-'}</span>
      {!isLive && <span className={styles.meta}>{statusLabel(match)}</span>}
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
