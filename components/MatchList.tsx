import type { Match } from '@/lib/types';
import { MatchCard } from './MatchCard';

export function MatchList({ matches, emptyLabel = 'No matches' }: { matches: Match[]; emptyLabel?: string }) {
  if (matches.length === 0) {
    return <p data-testid="match-list-empty">{emptyLabel}</p>;
  }
  return (
    <ul data-testid="match-list">
      {matches.map(match => (
        // [React] key must be stable and unique per item so React can match old/new DOM
        // nodes across re-renders instead of tearing everything down and rebuilding it —
        // Match.id (day + normalized opponent) is stable across polls, unlike array index.
        <li key={match.id}>
          <MatchCard match={match} />
        </li>
      ))}
    </ul>
  );
}
