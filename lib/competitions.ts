import type { CompetitionId } from './types';

export interface CompetitionMapping {
  id: CompetitionId;
  label: string;
  fdCode?: 'PL' | 'CL';
  espnSlug: string;
  hasStandings: boolean;
}

export const COMPETITIONS: CompetitionMapping[] = [
  { id: 'PL', label: 'Premier League', fdCode: 'PL', espnSlug: 'eng.1', hasStandings: true },
  { id: 'CL', label: 'UEFA Champions League', fdCode: 'CL', espnSlug: 'uefa.champions', hasStandings: true },
  { id: 'FA', label: 'FA Cup', espnSlug: 'eng.fa', hasStandings: false },
  { id: 'EFL', label: 'Carabao Cup', espnSlug: 'eng.league_cup', hasStandings: false },
  { id: 'FRIENDLY', label: 'Friendly', espnSlug: 'club.friendly', hasStandings: false },
];

export function getCompetition(id: CompetitionId): CompetitionMapping {
  const found = COMPETITIONS.find(c => c.id === id);
  if (!found) throw new Error(`Unknown competition id: ${id}`);
  return found;
}

export function competitionIdForFdCode(code: string): CompetitionId | undefined {
  return COMPETITIONS.find(c => c.fdCode === code)?.id;
}
