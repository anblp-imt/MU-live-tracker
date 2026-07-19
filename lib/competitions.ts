import type { CompetitionId, Match } from './types';

export interface CompetitionMapping {
  id: CompetitionId;
  label: string;
  navShortLabel: string;
  fdCode?: 'PL' | 'CL';
  espnSlug: string;
  hasStandings: boolean;
}

export const COMPETITIONS: CompetitionMapping[] = [
  { id: 'PL', label: 'Premier League', navShortLabel: 'PL', fdCode: 'PL', espnSlug: 'eng.1', hasStandings: true },
  { id: 'CL', label: 'UEFA Champions League', navShortLabel: 'UCL', fdCode: 'CL', espnSlug: 'uefa.champions', hasStandings: true },
  // EL/ECL: football-data.org's free tier doesn't cover these (HANDOFF.md's API survey —
  // only PL/CL standings are free), so no fdCode and hasStandings: false, same as FA/EFL
  // below — they render via CupRun's round-by-round view, not a league table, even
  // though both competitions do have a real 36-team Swiss-format league phase on ESPN.
  // Wiring a second standings source for them is a separate, larger effort (see this
  // plan's Global Constraints).
  { id: 'EL', label: 'UEFA Europa League', navShortLabel: 'UEL', espnSlug: 'uefa.europa', hasStandings: false },
  { id: 'ECL', label: 'UEFA Europa Conference League', navShortLabel: 'UECL', espnSlug: 'uefa.europa.conf', hasStandings: false },
  { id: 'FA', label: 'FA Cup', navShortLabel: 'FA Cup', espnSlug: 'eng.fa', hasStandings: false },
  { id: 'EFL', label: 'Carabao Cup', navShortLabel: 'Carabao', espnSlug: 'eng.league_cup', hasStandings: false },
  { id: 'FRIENDLY', label: 'Friendly', navShortLabel: 'Friendly', espnSlug: 'club.friendly', hasStandings: false },
];

export function getCompetition(id: CompetitionId): CompetitionMapping {
  const found = COMPETITIONS.find(c => c.id === id);
  if (!found) throw new Error(`Unknown competition id: ${id}`);
  return found;
}

export function competitionIdForFdCode(code: string): CompetitionId | undefined {
  return COMPETITIONS.find(c => c.fdCode === code)?.id;
}

// MU plays in at most one of these three per season (or none) — never more than one,
// and it's not the same one every year (depends on the prior season's finish). Showing
// all three as permanent tabs would mean two of them are dead all season, unlike FA/EFL
// (which are always relevant at the start of a season and only go quiet after MU is
// knocked out) — so these three are hidden entirely unless MU actually has a fixture in
// them, while every other competition keeps its current always-shown behavior.
const EUROPEAN_COMPETITION_IDS: CompetitionId[] = ['CL', 'EL', 'ECL'];

export function visibleCompetitions(matches: Match[], from: CompetitionMapping[] = COMPETITIONS): CompetitionMapping[] {
  return from.filter(c =>
    !EUROPEAN_COMPETITION_IDS.includes(c.id) || matches.some(m => m.competition === c.id),
  );
}
