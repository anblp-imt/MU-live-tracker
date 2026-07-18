import type { CompetitionId } from './types';

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
