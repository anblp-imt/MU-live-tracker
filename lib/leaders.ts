import type { EspnDetail, PlayerTally, SeasonLeaders } from './types';

// Goals/assists come from header.competitions[0].details (scoring plays only — verified
// live: a real finished match's `details` array held exactly its 3 goals and nothing
// else, no cards). Cards come from keyEvents instead (verified: the same match's one
// yellow card appeared there, not in `details`) — see this plan's "Verified ESPN Data
// Shapes" section for the full write-up.
export function extractMatchContributions(
  detail: EspnDetail,
  muEspnId: string,
): { goals: string[]; assists: string[]; yellowCards: string[] } {
  const details = detail.header.competitions[0]?.details || [];
  // Own goals are excluded entirely: an own-goal event's team.id is the side that
  // BENEFITS (i.e. MU, if it happened to fall MU's way), but participants[0] is the
  // OPPOSING player who put it into their own net — crediting that name to MU's
  // scorer/assist board would attribute an opponent's mistake to a Red Devil.
  const muGoals = details.filter(d => d.scoringPlay && !d.shootout && !d.ownGoal && d.team?.id === muEspnId);

  const goals = muGoals
    .map(g => g.participants?.[0]?.athlete?.displayName)
    .filter((name): name is string => Boolean(name));
  const assists = muGoals
    .map(g => g.participants?.[1]?.athlete?.displayName)
    .filter((name): name is string => Boolean(name));

  const yellowCards = (detail.keyEvents || [])
    .filter(e => e.type?.type === 'yellow-card' && e.team?.id === muEspnId)
    .map(e => e.participants?.[0]?.athlete?.displayName)
    .filter((name): name is string => Boolean(name));

  return { goals, assists, yellowCards };
}

function tally(names: string[], topN: number): PlayerTally[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, topN);
}

export function tallyLeaders(
  perMatch: Array<{ goals: string[]; assists: string[]; yellowCards: string[] }>,
  topN = 5,
): SeasonLeaders {
  return {
    topScorers: tally(perMatch.flatMap(m => m.goals), topN),
    topAssists: tally(perMatch.flatMap(m => m.assists), topN),
    topYellowCards: tally(perMatch.flatMap(m => m.yellowCards), topN),
  };
}
