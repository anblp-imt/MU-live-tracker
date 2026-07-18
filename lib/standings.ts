import type { CompetitionId, Match, StandingRow } from './types';
import { isManUtd } from './normalize';

// Football convention: oldest of the window first, most recent last (reads left-to-right
// as "how they've been trending", ending on "right now").
export function recentForm(matches: Match[], competition: CompetitionId, limit = 5): ('W' | 'D' | 'L')[] {
  const finished = matches
    .filter(m => m.competition === competition && m.status === 'FINISHED')
    .slice()
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
    .slice(0, limit);

  return finished
    .map((m): 'W' | 'D' | 'L' => {
      const muScore = m.venue === 'H' ? m.score.display.home : m.score.display.away;
      const oppScore = m.venue === 'H' ? m.score.display.away : m.score.display.home;
      if (muScore === null || oppScore === null || muScore === oppScore) return 'D';
      return muScore > oppScore ? 'W' : 'L';
    })
    .reverse();
}

// Large single-table competitions (e.g. Champions League's 36-team Swiss league phase)
// make MU's own row hard to find by scrolling. Returns MU's row plus `windowSize` rows
// on either side, clamped to the table's actual bounds — never invents empty rows past
// position 1 or the last position.
export function standingsAroundMu(standings: StandingRow[], windowSize = 2): StandingRow[] {
  const muIndex = standings.findIndex(row => isManUtd(row.team.name));
  if (muIndex === -1) return [];
  const start = Math.max(0, muIndex - windowSize);
  const end = Math.min(standings.length, muIndex + windowSize + 1);
  return standings.slice(start, end);
}
