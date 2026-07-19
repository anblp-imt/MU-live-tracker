import type { CompetitionId, Match } from './types';
import { matchResult } from './result';

export interface SeasonStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

// MU's own season tally, from MU's perspective (venue-aware, same as matchResult and
// lib/standings.ts's recentForm — muScore/oppScore depend on which side MU played on,
// not literal home/away). 'ALL' aggregates every competition; anything else filters to
// just that one.
export function computeSeasonStats(matches: Match[], competition: CompetitionId | 'ALL'): SeasonStats {
  const stats: SeasonStats = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };

  for (const m of matches) {
    if (m.status !== 'FINISHED') continue;
    if (competition !== 'ALL' && m.competition !== competition) continue;

    const result = matchResult(m);
    if (result === null) continue; // defensive: FINISHED but missing a score

    const muScore = m.venue === 'H' ? m.score.display.home : m.score.display.away;
    const oppScore = m.venue === 'H' ? m.score.display.away : m.score.display.home;

    stats.played += 1;
    if (result === 'W') stats.won += 1;
    else if (result === 'D') stats.drawn += 1;
    else stats.lost += 1;
    stats.goalsFor += muScore ?? 0;
    stats.goalsAgainst += oppScore ?? 0;
  }

  stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
  return stats;
}
