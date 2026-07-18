import type { CompetitionId, Match } from './types';

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
